import cors from 'cors'
import express from 'express'
import { ChoreoController, ChoreoService, createChoreoRoutes, 创建编舞执行消息网关 } from './features/编舞系统'
import { 机器人控制器 } from './features/机器人管理/controller'
import { 本地机器人仓库 } from './features/机器人管理/repository'
import { createRobotRoutes } from './features/机器人管理/routes'
import { createStudioConfigRoutes } from './features/设置/routes'
import { StudioWebSocketHost } from './infra/websocket/studio-ws-host'
import { logger } from './infra/logger'
import { 发送Http错误 } from './shared/http/controller'

export interface StudioAppContext {
  app: express.Application
  wsHost: StudioWebSocketHost
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
  await choreoService.初始化()

  const choreoController = new ChoreoController(choreoService)
  const robotController = new 机器人控制器(robotRepository)

  app.use(cors())
  app.use(express.json({ limit: '20mb' }))

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`)
    next()
  })

  app.use('/api/v1/robots', createRobotRoutes(robotController))
  app.use('/api/v1/config', createStudioConfigRoutes())
  app.use('/api/v1/choreo', createChoreoRoutes(choreoController))

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
      },
    })
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('未处理的错误', error)
    发送Http错误(res, error)
  })

  return { app, wsHost }
}
