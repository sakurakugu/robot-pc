#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import hashlib
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Iterable, Optional, Tuple

ROOT: Path = Path(__file__).resolve().parents[3]
LOGS_DIR: Path = ROOT / ".cache" / "logs"
PID_DIR: Path = ROOT / ".cache" / "pid"
STATE_DIR: Path = ROOT / ".cache" / "dev"
STATE_FILE: Path = STATE_DIR / "studio-start.json"


def 确保目录存在() -> None:
    (LOGS_DIR / "studio").mkdir(parents=True, exist_ok=True)
    PID_DIR.mkdir(parents=True, exist_ok=True)
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def 检查运行环境() -> None:
    if which("node") is None:
      print("未检测到 Node.js，请先安装 Node.js 24+", file=sys.stderr)
      sys.exit(1)
    if which("npm") is None and which("npm.cmd") is None:
      print("未检测到 npm，请先安装 Node.js", file=sys.stderr)
      sys.exit(1)


def 根据平台调整命令(command: list[str]) -> list[str]:
    if os.name == "nt" and command:
        exe = command[0]
        for candidate in (exe, f"{exe}.cmd", f"{exe}.bat", f"{exe}.exe"):
            resolved = which(candidate)
            if resolved:
                command[0] = resolved
                break
    return command


def run(cmd: Iterable[str], cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
    command = 根据平台调整命令(list(cmd))
    return subprocess.run(command, cwd=str(cwd) if cwd else None, check=check)


def _tee_stream(stream, log_file) -> None:
    try:
        for line in iter(stream.readline, ""):
            log_file.write(line)
            log_file.flush()
            sys.stdout.write(line)
            sys.stdout.flush()
    finally:
        try:
            stream.close()
        except Exception:
            pass
        log_file.close()


def spawn(cmd: Iterable[str], cwd: Path, log_path: Path) -> Tuple[subprocess.Popen, int]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "a", buffering=1, encoding="utf-8", errors="replace")
    command = 根据平台调整命令(list(cmd))
    proc = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        bufsize=1,
        errors="replace",
        env=os.environ.copy(),
    )
    if proc.stdout is not None:
        thread = threading.Thread(target=_tee_stream, args=(proc.stdout, log_file), daemon=True)
        thread.start()
    return proc, proc.pid


def write_pid(name: str, pid: int) -> None:
    PID_DIR.mkdir(parents=True, exist_ok=True)
    (PID_DIR / f"{name}.pid").write_text(str(pid), encoding="utf-8")


def read_pid(name: str) -> Optional[int]:
    pid_file = PID_DIR / f"{name}.pid"
    if not pid_file.exists():
        return None
    try:
        raw = pid_file.read_text(encoding="utf-8").strip()
        return int(raw.lstrip("\ufeff"))
    except Exception:
        return None


def 删除_pid_文件(name: str) -> None:
    (PID_DIR / f"{name}.pid").unlink(missing_ok=True)


def _windows_进程存在(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except Exception:
        return False

    output = (result.stdout or "").strip()
    if not output:
        return False
    if "没有运行的任务" in output or "No tasks are running" in output:
        return False
    return str(pid) in output


def 进程存在(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        return _windows_进程存在(pid)
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def 停止进程(pid: int) -> None:
    if pid <= 0:
        return

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return


def kill_pid_file(name: str) -> bool:
    pid = read_pid(name)
    if pid is None:
        return False
    try:
        停止进程(pid)
        for _ in range(30):
            if not 进程存在(pid):
                break
            time.sleep(0.1)
        删除_pid_文件(name)
        return True
    except ProcessLookupError:
        删除_pid_文件(name)
        return False
    except Exception:
        return False


def 清理陈旧_pid(name: str) -> Optional[int]:
    pid = read_pid(name)
    if pid is None or 进程存在(pid):
        return None
    删除_pid_文件(name)
    return pid


def 读取状态() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {}
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def 写入状态(state: dict[str, Any]) -> None:
    确保目录存在()
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def 读取依赖哈希(key: str) -> Optional[str]:
    hashes = 读取状态().get("hash")
    if not isinstance(hashes, dict):
        return None
    value = hashes.get(key)
    return str(value) if value else None


def 保存依赖哈希(key: str, digest: str) -> None:
    state = 读取状态()
    hashes = state.get("hash")
    if not isinstance(hashes, dict):
        hashes = {}
        state["hash"] = hashes
    hashes[key] = digest
    写入状态(state)


def _选择依赖文件(dir_path: Path) -> Path:
    for filename in ("package-lock.json", "package.json"):
        file_path = dir_path / filename
        if file_path.exists():
            return file_path
    raise RuntimeError(f"未找到依赖描述文件: {dir_path}")


def _计算文件哈希(file_path: Path) -> str:
    return hashlib.md5(file_path.read_bytes()).hexdigest()


def 确保node_modules存在(dir_path: Path, *, 名称: str, 哈希键: str) -> None:
    node_modules = dir_path / "node_modules"
    描述文件 = _选择依赖文件(dir_path)
    当前哈希 = _计算文件哈希(描述文件)
    已记录哈希 = 读取依赖哈希(哈希键)

    if node_modules.exists() and 已记录哈希 == 当前哈希:
        return

    if node_modules.exists():
        print(f"检测到{名称}依赖变化，重新安装依赖")
    else:
        print(f"安装{名称}依赖")

    run(["npm", "install"], cwd=dir_path)
    保存依赖哈希(哈希键, 当前哈希)


def 检查端口是否被占用(port: int) -> bool:
    for host, family in (("127.0.0.1", socket.AF_INET), ("::1", socket.AF_INET6)):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.3)
                if sock.connect_ex((host, port)) == 0:
                    return True
        except Exception:
            continue
    return False


def _读取_windows_命令行(pid: int) -> str:
    try:
        output = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine",
            ],
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception:
        return ""
    return output.strip()


def 查找端口监听进程(port: int) -> list[tuple[int, str]]:
    try:
        output = subprocess.check_output(
            ["netstat", "-ano"],
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception:
        return []

    listeners: list[tuple[int, str]] = []
    seen: set[int] = set()
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        upper_line = line.upper()
        if "LISTENING" not in upper_line and "LISTEN" not in upper_line:
            continue
        if f":{port}" not in line:
            continue

        columns = [item for item in line.split() if item]
        if not columns:
            continue
        try:
            pid = int(columns[-1])
        except Exception:
            continue
        if pid in seen:
            continue
        seen.add(pid)
        listeners.append((pid, _读取_windows_命令行(pid)))
    return listeners


def _判断是否为_studio_进程(pid: int, command_line: str) -> bool:
    known_pids = {
        read_pid("studio-backend"),
        read_pid("studio-frontend"),
    }
    if pid in known_pids:
        return True

    if not command_line:
        return False

    normalized = command_line.replace("/", "\\").lower()
    markers = [
        str(ROOT / "前端").replace("/", "\\").lower(),
        str(ROOT / "后端").replace("/", "\\").lower(),
        "robot-studio",
        "vite",
        "ts-node-dev",
    ]
    return any(marker in normalized for marker in markers)


def _终止并等待进程退出(pid: int) -> bool:
    if pid <= 0:
        return False
    停止进程(pid)
    for _ in range(50):
        if not 进程存在(pid):
            return True
        time.sleep(0.1)
    return not 进程存在(pid)


def 清理_studio_端口占用(port: int) -> list[int]:
    killed_pids: list[int] = []
    for pid, command_line in 查找端口监听进程(port):
        if not _判断是否为_studio_进程(pid, command_line):
            continue
        if _终止并等待进程退出(pid):
            killed_pids.append(pid)
    return killed_pids
