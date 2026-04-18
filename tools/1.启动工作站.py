#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Robot Studio 本地工作站启动器。

start:      启动前端和后端开发服务
stop:       停止前端和后端开发服务
restart:    重启前端和后端开发服务
status:     查看当前 PID 记录与本地端口状态
"""

from __future__ import annotations

import argparse
import sys

from scripts.start.orchestrator import restart_all, start_all, status_all, stop_all


def main() -> None:
    parser = argparse.ArgumentParser(description="Robot Studio 本地工作站启动器")
    parser.add_argument(
        "command",
        nargs="?",
        default="start",
        choices=["start", "stop", "restart", "status"],
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

    print(f"不支持的命令: {args.command}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
