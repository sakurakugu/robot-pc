#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import os
import shutil
from pathlib import Path

from .utils import ROOT, run, 检查运行环境, 确保node_modules存在

DESKTOP_DIR = ROOT
FRONTEND_DIR = ROOT / "前端"
BACKEND_DIR = ROOT / "后端"
ELECTRON_CACHE_DIR = ROOT / ".cache" / "electron"
ELECTRON_RUNTIME_DIR = ELECTRON_CACHE_DIR / "runtime"
ELECTRON_DIST_DIR = ELECTRON_CACHE_DIR / "dist"
ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"


def _规范化绝对路径(target: Path) -> str:
    return os.path.normcase(str(target.resolve(strict=False)))


def _安全删除目录(target_dir: Path) -> None:
    if not target_dir.exists():
        return

    root_str = _规范化绝对路径(ROOT)
    target_str = _规范化绝对路径(target_dir)
    if os.path.commonpath([root_str, target_str]) != root_str:
        raise ValueError(f"拒绝删除工作区外目录: {target_dir}")

    shutil.rmtree(target_dir)


def _复制目录(source_dir: Path, target_dir: Path) -> None:
    if not source_dir.exists():
        raise FileNotFoundError(f"未找到目录: {source_dir}")
    shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)


def _复制文件(source_file: Path, target_file: Path) -> None:
    if not source_file.exists():
        raise FileNotFoundError(f"未找到文件: {source_file}")
    target_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_file, target_file)


def _打开目录(target_dir: Path) -> None:
    if os.name == "nt":
        os.startfile(target_dir)


def _执行检查() -> None:
    checks = [
        ("桌面端 lint", DESKTOP_DIR, ["npm", "run", "lint"]),
        ("桌面端 typecheck", DESKTOP_DIR, ["npm", "run", "typecheck"]),
        ("前端 lint", FRONTEND_DIR, ["npm", "run", "lint"]),
        ("前端 typecheck", FRONTEND_DIR, ["npm", "run", "typecheck"]),
        ("后端 lint", BACKEND_DIR, ["npm", "run", "lint"]),
        ("后端 typecheck", BACKEND_DIR, ["npm", "run", "typecheck"]),
    ]
    for label, cwd, command in checks:
        print(f"执行{label}...")
        run(command, cwd=cwd)


def _执行构建() -> None:
    builds = [
        ("桌面端 build", DESKTOP_DIR, ["npm", "run", "build"]),
        ("前端 build", FRONTEND_DIR, ["npm", "run", "build"]),
        ("后端 build", BACKEND_DIR, ["npm", "run", "build"]),
    ]
    for label, cwd, command in builds:
        print(f"执行{label}...")
        run(command, cwd=cwd)


def _准备运行时目录() -> Path:
    runtime_backend_dir = ELECTRON_RUNTIME_DIR / "backend"
    runtime_frontend_dir = ELECTRON_RUNTIME_DIR / "frontend"

    ELECTRON_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _安全删除目录(ELECTRON_RUNTIME_DIR)
    ELECTRON_RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

    _复制目录(BACKEND_DIR / "dist", runtime_backend_dir / "dist")
    _复制目录(FRONTEND_DIR / "dist", runtime_frontend_dir / "dist")
    _复制文件(BACKEND_DIR / "package.json", runtime_backend_dir / "package.json")
    _复制文件(BACKEND_DIR / "package-lock.json", runtime_backend_dir / "package-lock.json")

    print("安装 Electron 运行时所需的后端生产依赖...")
    run(["npm", "install", "--omit=dev"], cwd=runtime_backend_dir)
    return ELECTRON_RUNTIME_DIR


def _构建安装包() -> None:
    print("构建 Electron Windows 安装包...")
    run(
        ["npm", "run", "dist:win"],
        cwd=DESKTOP_DIR,
        env={
            "ELECTRON_BUILDER_BINARIES_MIRROR": ELECTRON_BUILDER_BINARIES_MIRROR,
        },
    )


def _查找最新安装包() -> Path:
    installers = sorted(
        ELECTRON_DIST_DIR.glob("*.exe"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    if not installers:
        raise FileNotFoundError(f"未在 {ELECTRON_DIST_DIR} 找到安装包")
    return installers[0]


def build_release_bundle() -> tuple[Path, Path]:
    检查运行环境()
    确保node_modules存在(DESKTOP_DIR, 名称="桌面端", 哈希键="desktop_package")
    确保node_modules存在(FRONTEND_DIR, 名称="前端", 哈希键="frontend_package")
    确保node_modules存在(BACKEND_DIR, 名称="后端", 哈希键="backend_package")

    _执行检查()
    _执行构建()
    runtime_dir = _准备运行时目录()
    _构建安装包()
    installer_path = _查找最新安装包()

    print("Robot PC Electron 安装包构建完成")
    print(f"运行时目录: {runtime_dir}")
    print(f"安装包: {installer_path}")
    _打开目录(ELECTRON_DIST_DIR)
    return runtime_dir, installer_path
