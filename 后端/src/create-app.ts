import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { ChoreoController, ChoreoService, createChoreoRoutes, 创建编舞执行消息网关 } from './features/编舞系统'
import { 地图工作台控制器 } from './features/地图工作台/controller'
import { createMappingRoutes } from './features/地图工作台/routes'
import { 地图工作台服务 } from './features/地图工作台/service'
import { 机器人控制器 } from './features/机器人管理/controller'
import { 本地机器人仓库 } from './features/机器人管理/repository'
import { createRobotRoutes } from './features/机器人管理/routes'
import { createStudioConfigRoutes } from './features/设置/routes'
import { createDeveloperRoutes } from './features/开发者工具/routes'
import 配置 from './infra/config'
import { StudioWebSocketHost } from './infra/websocket/studio-ws-host'
import { logger } from './infra/logger'
import { 发送Http错误 } from './shared/http/controller'

export interface StudioAppContext {
  app: express.Application
  wsHost: StudioWebSocketHost
}

function 获取前端静态资源目录(): { 目录: string; 入口文件: string } | null {
  const 候选目录 = [
    process.env.ROBOT_STUDIO_WEB_DIST,
    path.resolve(__dirname, '../../前端/dist'),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const 目录 of 候选目录) {
    const 绝对目录 = path.resolve(目录)
    const 入口文件 = path.join(绝对目录, 'index.html')
    if (!fs.existsSync(入口文件)) {
      continue
    }
    return { 目录: 绝对目录, 入口文件 }
  }

  return null
}

function 挂载前端静态资源(app: express.Application): void {
  const 静态资源 = 获取前端静态资源目录()
  if (!静态资源) {
    return
  }

  app.use(express.static(静态资源.目录))
  app.get(/^(?!\/api\/v1(?:\/|$)).*/, (_req, res) => {
    res.sendFile(静态资源.入口文件)
  })
}

export async function createApp(): Promise<StudioAppContext> {
  const app = express()
  const wsHost = new StudioWebSocketHost()
  const robotRepository = new 本地机器人仓库()
  const choreoGateway = 创建编舞执行消息网关(wsHost)
  const choreoService = new ChoreoService({
    机器人仓库: robotRepository,
    执行消息网关: choreoGateway,
  })
  const mappingService = new 地图工作台服务({
    地图目录: 配置.地图目录,
    巡逻目录: 配置.巡逻目录,
    机器人仓库: robotRepository,
    发送到机器人: (robotId, message) => wsHost.sendToRobot(robotId, message),
    是否机器人在线: (robotId) => wsHost.isRobotConnected(robotId),
    广播: (message) => {
      wsHost.broadcast(message)
    },
  })
  await choreoService.初始化()
  await mappingService.初始化()

  wsHost.onMessage((message, context) => {
    if (context.role === 'robot' && context.robotId) {
      mappingService.处理机器人消息(context.robotId, message)
    }
  })

  const choreoController = new ChoreoController(choreoService)
  const mappingController = new 地图工作台控制器(mappingService)
  const robotController = new 机器人控制器(robotRepository, (robotId) => wsHost.isRobotConnected(robotId))

  app.use(cors())
  app.use(express.json({ limit: '20mb' }))

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`)
    next()
  })

  app.use('/api/v1/robots', createRobotRoutes(robotController))
  app.use('/api/v1/config', createStudioConfigRoutes())
  app.use('/api/v1/choreo', createChoreoRoutes(choreoController))
  app.use('/api/v1/mapping', createMappingRoutes(mappingController))
  app.use('/api/v1/developer', createDeveloperRoutes())

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
      },
    })
  })

  挂载前端静态资源(app)

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('未处理的错误', error)
    发送Http错误(res, error)
  })

  return { app, wsHost }
}
