#!/bin/bash

# Robot PC 依赖检查脚本

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/前端"
BACKEND_DIR="$ROOT_DIR/后端"

print_ok() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
print_err() { echo -e "${RED}[✗]${NC} $1"; }

check_command() {
  local cmd=$1
  local name=$2
  if command -v "$cmd" >/dev/null 2>&1; then
    print_ok "$name: $($cmd --version 2>&1 | head -n 1)"
  else
    print_err "$name 未安装"
  fi
}

check_node_modules() {
  local dir=$1
  local name=$2
  if [ -d "$dir/node_modules" ]; then
    print_ok "$name 依赖已安装"
  else
    print_warn "$name 需要运行 npm install"
  fi
}

echo "========================================"
echo "  Robot PC 依赖检查"
echo "========================================"

check_command node "Node.js"
check_command npm "npm"
check_command python "Python"

check_node_modules "$FRONTEND_DIR" "前端"
check_node_modules "$BACKEND_DIR" "后端"

echo ""
echo "前端目录: $FRONTEND_DIR"
echo "后端目录: $BACKEND_DIR"
