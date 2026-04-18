#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Iterable, Optional, Tuple

ROOT: Path = Path(__file__).resolve().parents[3]
LOGS_DIR: Path = ROOT / ".cache" / "logs"
PID_DIR: Path = ROOT / ".cache" / "pid"


def 确保目录存在() -> None:
    (LOGS_DIR / "studio").mkdir(parents=True, exist_ok=True)
    PID_DIR.mkdir(parents=True, exist_ok=True)


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
    for line in iter(stream.readline, ""):
        log_file.write(line)
        log_file.flush()
        sys.stdout.write(line)
        sys.stdout.flush()


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
        return int(pid_file.read_text(encoding="utf-8").strip())
    except Exception:
        return None


def kill_pid_file(name: str) -> bool:
    pid = read_pid(name)
    if pid is None:
        return False
    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(30):
            try:
                os.kill(pid, 0)
                time.sleep(0.1)
            except ProcessLookupError:
                break
        (PID_DIR / f"{name}.pid").unlink(missing_ok=True)
        return True
    except ProcessLookupError:
        (PID_DIR / f"{name}.pid").unlink(missing_ok=True)
        return False
    except Exception:
        return False


def 确保node_modules存在(dir_path: Path) -> None:
    if not (dir_path / "node_modules").exists():
        print(f"安装依赖: {dir_path}")
        run(["npm", "install"], cwd=dir_path)


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
