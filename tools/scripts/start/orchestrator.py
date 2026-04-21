#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import time
import urllib.error
import urllib.request
from pathlib import Path

from .packager import build_release_bundle
from .utils import (
    LOGS_DIR,
    ROOT,
    确保目录存在,
    确保node_modules存在,
    查找端口监听进程,
    检查端口是否被占用,
    检查运行环境,
    kill_pid_file,
    清理_studio_端口占用,
    清理陈旧_pid,
    进程存在,
    read_pid,
    run,
    spawn,
    write_pid,
)

STUDIO_DIR = ROOT
FRONTEND_DIR = ROOT / "前端"
BACKEND_DIR = ROOT / "后端"
FRONTEND_PORT = 5175
BACKEND_PORT = 9010
FRONTEND_URL = f"http://127.0.0.1:{FRONTEND_PORT}/"
BACKEND_HEALTH_URL = f"http://127.0.0.1:{BACKEND_PORT}/api/v1/health"
SCRIPT_PATH = ROOT / "tools" / "1.启动电脑端.py"


def _清理陈旧记录() -> None:
    for name, label in (("studio-backend", "后端"), ("studio-frontend", "前端")):
        pid = 清理陈旧_pid(name)
        if pid is not None:
            print(f"清理陈旧{label} PID 记录: {pid}")


def _格式化端口监听详情(port: int) -> str:
    listeners = 查找端口监听进程(port)
    if not listeners:
        return "未知进程"
    return "；".join(
        f"PID={pid} CMD={command_line or '未知命令行'}"
        for pid, command_line in listeners
    )


def _检查端口(*, 尝试自动清理: bool = False) -> None:
    occupied = []
    if 尝试自动清理:
        _清理陈旧记录()
        for port, label in ((FRONTEND_PORT, "前端"), (BACKEND_PORT, "后端")):
            killed_pids = 清理_studio_端口占用(port)
            if killed_pids:
                print(f"已清理占用{label}端口 {port} 的旧进程: {', '.join(str(pid) for pid in killed_pids)}")

    if 检查端口是否被占用(FRONTEND_PORT):
        occupied.append(f"前端端口 {FRONTEND_PORT}")
    if 检查端口是否被占用(BACKEND_PORT):
        occupied.append(f"后端端口 {BACKEND_PORT}")
    if occupied:
        details = []
        if 检查端口是否被占用(FRONTEND_PORT):
            details.append(f"前端端口 {FRONTEND_PORT}: {_格式化端口监听详情(FRONTEND_PORT)}")
        if 检查端口是否被占用(BACKEND_PORT):
            details.append(f"后端端口 {BACKEND_PORT}: {_格式化端口监听详情(BACKEND_PORT)}")
        raise RuntimeError(
            "以下端口已被占用，请先处理后再重试:\n"
            + "\n".join(details)
        )


def _检查_http(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return 200 <= response.status < 400
    except (urllib.error.URLError, TimeoutError, ValueError):
        return False


def _等待服务就绪(
    name: str,
    url: str,
    *,
    process,
    log_path: Path,
    timeout: float = 25.0,
) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _检查_http(url):
            return
        if process.poll() is not None:
            raise RuntimeError(f"{name} 启动失败，请查看日志: {log_path}")
        time.sleep(0.5)
    raise RuntimeError(f"{name} 启动超时，请查看日志: {log_path}")


def _读取进程状态(name: str) -> tuple[str, int]:
    pid = read_pid(name) or 0
    if pid <= 0:
        return "未记录", 0
    if 进程存在(pid):
        return "正在运行", pid
    return "PID 已记录但进程不存在", pid


def _打印启动摘要(backend_log: Path, frontend_log: Path) -> None:
    print("")
    print("Robot PC 已启动:")
    print(f"  前端: {FRONTEND_URL}")
    print(f"  后端健康检查: {BACKEND_HEALTH_URL}")
    print(f"  前端日志: {frontend_log}")
    print(f"  后端日志: {backend_log}")
    print(f"  停止命令: python {SCRIPT_PATH} stop")
    print("按 Ctrl+C 可停止工作站并退出。")


def _持续监控() -> None:
    上次中断时间 = 0.0
    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            当前时间 = time.monotonic()
            if 当前时间 - 上次中断时间 <= 2:
                print("")
                print("检测到 Ctrl+C，正在停止 Robot PC")
                stop_all()
                break
            上次中断时间 = 当前时间
            print("")
            print("收到中断信号，再按一次 Ctrl+C 才会停止工作站")
            continue

        backend_pid = read_pid("studio-backend") or 0
        frontend_pid = read_pid("studio-frontend") or 0
        backend_alive = 进程存在(backend_pid)
        frontend_alive = 进程存在(frontend_pid)

        if not backend_alive and not frontend_alive:
            print("Robot PC 进程已全部退出")
            break

        if backend_alive and frontend_alive:
            continue

        print("检测到部分开发进程已退出，正在停止剩余进程")
        stop_all()
        break


def start_all() -> None:
    检查运行环境()
    确保目录存在()
    _检查端口(尝试自动清理=True)

    确保node_modules存在(FRONTEND_DIR, 名称="前端", 哈希键="frontend_package")
    确保node_modules存在(BACKEND_DIR, 名称="后端", 哈希键="backend_package")

    backend_log = LOGS_DIR / "studio" / "backend.log"
    frontend_log = LOGS_DIR / "studio" / "frontend.log"

    backend_started = False
    frontend_started = False
    try:
        print(f"启动 Robot PC 后端... ({BACKEND_HEALTH_URL})")
        backend_proc, backend_pid = spawn(["npm", "run", "dev"], cwd=BACKEND_DIR, log_path=backend_log)
        write_pid("studio-backend", backend_pid)
        backend_started = True

        print(f"启动 Robot PC 前端... ({FRONTEND_URL})")
        frontend_proc, frontend_pid = spawn(
            ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(FRONTEND_PORT)],
            cwd=FRONTEND_DIR,
            log_path=frontend_log,
        )
        write_pid("studio-frontend", frontend_pid)
        frontend_started = True

        print("等待后端健康检查通过...")
        _等待服务就绪("后端", BACKEND_HEALTH_URL, process=backend_proc, log_path=backend_log)
        print("等待前端开发服务器就绪...")
        _等待服务就绪("前端", FRONTEND_URL, process=frontend_proc, log_path=frontend_log)
    except Exception:
        if backend_started or frontend_started:
            stop_all()
        raise

    _打印启动摘要(backend_log, frontend_log)
    _持续监控()


def stop_all() -> None:
    stopped_backend = kill_pid_file("studio-backend")
    stopped_frontend = kill_pid_file("studio-frontend")
    _清理陈旧记录()
    if stopped_backend or stopped_frontend:
        print("Robot PC 已停止")
    else:
        print("没有运行中的 Robot PC 进程")


def restart_all() -> None:
    stop_all()
    time.sleep(0.5)
    start_all()


def check_all() -> None:
    检查运行环境()
    确保目录存在()
    确保node_modules存在(STUDIO_DIR, 名称="桌面端", 哈希键="desktop_package")
    确保node_modules存在(FRONTEND_DIR, 名称="前端", 哈希键="frontend_package")
    确保node_modules存在(BACKEND_DIR, 名称="后端", 哈希键="backend_package")

    checks = [
        ("桌面端", "lint", STUDIO_DIR, ["npm", "run", "lint"]),
        ("桌面端", "typecheck", STUDIO_DIR, ["npm", "run", "typecheck"]),
        ("前端", "lint", FRONTEND_DIR, ["npm", "run", "lint"]),
        ("前端", "typecheck", FRONTEND_DIR, ["npm", "run", "typecheck"]),
        ("后端", "lint", BACKEND_DIR, ["npm", "run", "lint"]),
        ("后端", "typecheck", BACKEND_DIR, ["npm", "run", "typecheck"]),
    ]
    for scope, action, cwd, command in checks:
        print(f"执行{scope}{action}...")
        run(command, cwd=cwd)

    print("Robot PC 检查已全部通过")


def build_all() -> None:
    build_release_bundle()


def status_all() -> None:
    _清理陈旧记录()
    print("========================================")
    print("  Robot PC - 状态")
    print("========================================")
    for label, name in (("后端", "studio-backend"), ("前端", "studio-frontend")):
        state, pid = _读取进程状态(name)
        print(f"{label}: {state} (PID={pid})")

    print(f"前端端口 {FRONTEND_PORT}: {'占用中' if 检查端口是否被占用(FRONTEND_PORT) else '空闲'}")
    print(f"后端端口 {BACKEND_PORT}: {'占用中' if 检查端口是否被占用(BACKEND_PORT) else '空闲'}")
    if 检查端口是否被占用(FRONTEND_PORT):
        print(f"前端监听详情: {_格式化端口监听详情(FRONTEND_PORT)}")
    if 检查端口是否被占用(BACKEND_PORT):
        print(f"后端监听详情: {_格式化端口监听详情(BACKEND_PORT)}")
    print(f"前端可访问: {'正常' if _检查_http(FRONTEND_URL) else '失败'}")
    print(f"后端健康检查: {'正常' if _检查_http(BACKEND_HEALTH_URL) else '失败'}")
    print(f"前端日志: {LOGS_DIR / 'studio' / 'frontend.log'}")
    print(f"后端日志: {LOGS_DIR / 'studio' / 'backend.log'}")
