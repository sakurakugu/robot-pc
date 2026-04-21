import { createServer } from 'node:http'
import 配置 from './infra/config'
import { logger } from './infra/logger'
import { createApp } from './create-app'

export interface RobotPcServer {
  close: () => Promise<void>
  port: number
}

export async function 启动RobotPc后端(): Promise<RobotPcServer> {
  await logger.初始化()
  const studio = await createApp()
  const httpServer = createServer(studio.app)
  studio.wsHost.初始化(httpServer)

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(配置.port, () => {
      logger.info('Robot PC 本地后端已启动', {
        port: 配置.port,
      })
      resolve()
    })
  })

  return {
    port: 配置.port,
    close: () => new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}

async function main(): Promise<void> {
  const server = await 启动RobotPc后端()

  const 优雅退出 = (signal: string) => {
    logger.info('收到退出信号，准备关闭 Robot PC 本地后端', { signal })
    server.close().then(
      () => {
        process.exit(0)
      },
      (error) => {
        logger.error('关闭 Robot PC 本地后端失败', error)
        process.exit(1)
      },
    )
  }

  process.on('SIGINT', () => 优雅退出('SIGINT'))
  process.on('SIGTERM', () => 优雅退出('SIGTERM'))
}

if (require.main === module) {
  void main().catch((error) => {
    logger.error('Robot PC 启动失败', error)
    process.exit(1)
  })
}
