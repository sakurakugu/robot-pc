import { createServer } from 'node:http'
import 配置 from './infra/config'
import { logger } from './infra/logger'
import { createApp } from './create-app'

async function main(): Promise<void> {
  await logger.初始化()
  const studio = await createApp()
  const httpServer = createServer(studio.app)
  studio.wsHost.初始化(httpServer)

  httpServer.listen(配置.port, () => {
    logger.info('Robot Studio 本地后端已启动', {
      port: 配置.port,
    })
  })
}

void main().catch((error) => {
  logger.error('Robot Studio 启动失败', error)
  process.exit(1)
})
