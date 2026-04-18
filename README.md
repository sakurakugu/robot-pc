# robot-studio

机器狗电脑端工作站，负责以下本地优先能力：

- 编舞编辑与执行
- 地图查看与建图过程查看
- 定位、导航与雷达调试
- 局域网直连机器人
- 本地资源、日志与项目文件管理

## 规划目录

```text
robot-studio/
├── 前端/          # Vue 3 + TypeScript + Vite
├── 后端/          # Node.js + TypeScript，本地 API / WebSocket
├── 桌面壳/        # 后续接入 Tauri
└── docs/          # 设计与使用文档
```

## 定位

- `robot-cloud` 负责云端管理、账号权限、远程接入与资产管理
- `robot-studio` 负责电脑端重交互、本地调试与专业工作流

## 当前阶段

当前仓库已创建，后续将优先迁入编舞系统，再补地图与建图调试能力。
