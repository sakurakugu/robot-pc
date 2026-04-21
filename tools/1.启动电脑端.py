#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Robot PC 本地工作站启动器。

start:      启动前端和后端开发服务
stop:       停止前端和后端开发服务
restart:    重启前端和后端开发服务
status:     查看当前 PID 记录与本地端口状态
check:      执行桌面端、前端和后端 lint/typecheck
build:      构建 Electron 安装包
"""

from __future__ import annotations

import argparse
import os
import sys

from scripts.start.orchestrator import build_all, check_all, restart_all, start_all, status_all, stop_all


def _配置标准流编码() -> None:
    if os.name != "nt":
        return

    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


_配置标准流编码()


def main() -> None:
    parser = argparse.ArgumentParser(description="Robot PC 本地工作站启动器")
    parser.add_argument(
        "command",
        nargs="?",
        default="restart",
        choices=["start", "stop", "restart", "status", "check", "build", "package"],
        help="要执行的命令",
    )
    args = parser.parse_args()

    if args.command == "start":
        start_all()
        return
    if args.command == "stop":
        stop_all()
        return
    if args.command == "restart":
        restart_all()
        return
    if args.command == "status":
        status_all()
        return
    if args.command == "check":
        check_all()
        return
    if args.command in {"build", "package"}:
        build_all()
        return

    print(f"不支持的命令: {args.command}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
