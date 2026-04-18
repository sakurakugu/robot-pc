# robot-studio

机器狗电脑端工作站，负责以下本地优先能力：

- 编舞编辑与执行
- 地图查看与建图过程查看
- 定位、导航与雷达调试
- 局域网直连机器人
- 本地资源、日志与项目文件管理

## 当前目录

```text
robot-studio/
├── 前端/          # Vue 3 + TypeScript + Vite
├── 后端/          # Node.js + TypeScript，本地 API / WebSocket
└── docs/          # 设计与使用文档
```

## 定位

- `robot-cloud` 负责云端管理、账号权限、远程接入与资产管理
- `robot-studio` 负责电脑端重交互、本地调试与专业工作流

## 启动方式

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

- 前端默认端口：`5175`
- 后端默认端口：`9010`

## 当前阶段

当前已完成工作站基础骨架，并迁入第一批编舞系统代码。
后续将继续补地图查看、建图过程调试和本地机器人直连能力。
