#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import time
from pathlib import Path

from .utils import (
    LOGS_DIR,
    ROOT,
    write_pid,
    kill_pid_file,
    spawn,
    确保node_modules存在,
    确保目录存在,
    检查端口是否被占用,
    检查运行环境,
)

STUDIO_DIR = ROOT
FRONTEND_DIR = ROOT / "前端"
BACKEND_DIR = ROOT / "后端"
FRONTEND_PORT = 5175
BACKEND_PORT = 9010


def _检查端口() -> None:
    occupied = []
    if 检查端口是否被占用(FRONTEND_PORT):
        occupied.append(f"前端端口 {FRONTEND_PORT}")
    if 检查端口是否被占用(BACKEND_PORT):
        occupied.append(f"后端端口 {BACKEND_PORT}")
    if occupied:
        raise RuntimeError(f"以下端口已被占用: {', '.join(occupied)}")


def start_all() -> None:
    检查运行环境()
    确保目录存在()
    _检查端口()

    确保node_modules存在(FRONTEND_DIR)
    确保node_modules存在(BACKEND_DIR)

    backend_log = LOGS_DIR / "studio" / "backend.log"
    frontend_log = LOGS_DIR / "studio" / "frontend.log"

    print(f"启动 Robot Studio 后端... (http://127.0.0.1:{BACKEND_PORT})")
    _backend_proc, backend_pid = spawn(["npm", "run", "dev"], cwd=BACKEND_DIR, log_path=backend_log)
    write_pid("studio-backend", backend_pid)

    print(f"启动 Robot Studio 前端... (http://127.0.0.1:{FRONTEND_PORT})")
    _frontend_proc, frontend_pid = spawn(["npm", "run", "dev", "--", "--port", str(FRONTEND_PORT)], cwd=FRONTEND_DIR, log_path=frontend_log)
    write_pid("studio-frontend", frontend_pid)

    print("Robot Studio 启动完成")


def stop_all() -> None:
    stopped_backend = kill_pid_file("studio-backend")
    stopped_frontend = kill_pid_file("studio-frontend")
    if stopped_backend or stopped_frontend:
        print("Robot Studio 已停止")
    else:
        print("没有运行中的 Robot Studio 进程")


def restart_all() -> None:
    stop_all()
    time.sleep(0.5)
    start_all()


def status_all() -> None:
    print("========================================")
    print("  Robot Studio - 状态")
    print("========================================")
    for name in ("studio-backend", "studio-frontend"):
        pid_file = ROOT / ".cache" / "pid" / f"{name}.pid"
        print(f"{name}: {'已记录' if pid_file.exists() else '未记录'}")

    print(f"前端端口 {FRONTEND_PORT}: {'占用中' if 检查端口是否被占用(FRONTEND_PORT) else '空闲'}")
    print(f"后端端口 {BACKEND_PORT}: {'占用中' if 检查端口是否被占用(BACKEND_PORT) else '空闲'}")
