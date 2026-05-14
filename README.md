# robot-pc

机器狗电脑端工作站，当前是局域网的工作台。

## 当前职责

- 本地机器人管理
- 局域网接入与诊断
- 机器人操作页
- 地图工作台
- 编舞编辑
- 本地视频与低时延直控

## 目录结构

```text
robot-pc/
├── 前端/                    # Vue 3 + Vite
├── 后端/                    # Node.js + Express + WebSocket
├── electron/                # Electron 主进程
├── tools/                   # 启动、检查、打包脚本
├── docs/                    # 设计文档
└── README.md
```

## 环境要求

- Node.js `24.x`
- npm

## 推荐启动方式

统一用脚本：

```bash
python tools/1.启动电脑端.py
```

默认行为是 `restart`，会同时启动前端和后端开发服务。

常用命令：

```bash
python tools/1.启动电脑端.py start
python tools/1.启动电脑端.py stop
python tools/1.启动电脑端.py restart
python tools/1.启动电脑端.py status
python tools/1.启动电脑端.py check
python tools/1.启动电脑端.py build
```

## 直接分开启动

```bash
# 前端
cd 前端
npm install
npm run dev

# 后端
cd 后端
npm install
npm run dev
```

桌面端打包依赖根目录 `package.json` 与 `electron/`。

## 默认端口

- 前端：`5175`
- 后端：`9010`
- 健康检查：`http://127.0.0.1:9010/api/v1/health`

前端开发代理：

- `/api/v1` -> `http://127.0.0.1:9010`
- `/api/v1/web` -> `ws://127.0.0.1:9010`

## 校验

前端：

```bash
cd 前端
npm run lint
npm run typecheck
```

后端：

```bash
cd 后端
npm run lint
npm run typecheck
```

桌面端：

```bash
npm run lint
npm run typecheck
```

如果你只是想一次跑完当前仓库的工作站检查，直接使用：

```bash
python tools/1.启动电脑端.py check
```

## 打包

Electron 安装包构建：

```bash
python tools/1.启动电脑端.py build
```

或：

```bash
npm run build
npm run dist:win
```

## 定位说明

- `robot-pc` 负责本地优先工作流
- `robot-cloud` 负责远程管理与账号体系

两者会共享一部分机器人资料，但当前控制主链路仍以工作站局域网直连为主。
