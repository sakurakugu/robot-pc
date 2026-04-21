import { Router } from 'express'
import { 处理控制器, 返回数据 } from '../../shared/http/controller'
import { Http错误工厂 } from '../../shared/http/errors'
import { 本地工作站设置仓库 } from './repository'

export function createStudioConfigRoutes(): Router {
  const router = Router()
  const repository = new 本地工作站设置仓库()

  router.get('/ui', 处理控制器(async () => 返回数据(
    await repository.读取UI配置(),
  )))

  router.put('/ui', 处理控制器(async (req) => {
    const body = typeof req.body === 'object' && req.body ? req.body as Record<string, unknown> : {}
    const cloudBaseUrl = body.cloudBaseUrl
    const cloudEnvironments = body.cloudEnvironments
    const activeCloudEnvironmentId = body.activeCloudEnvironmentId
    if (
      cloudBaseUrl !== undefined
      && cloudBaseUrl !== null
      && typeof cloudBaseUrl !== 'string'
    ) {
      throw Http错误工厂.参数错误('云端地址格式不正确')
    }
    if (cloudEnvironments !== undefined && cloudEnvironments !== null && !Array.isArray(cloudEnvironments)) {
      throw Http错误工厂.参数错误('云端环境列表格式不正确')
    }
    if (
      activeCloudEnvironmentId !== undefined
      && activeCloudEnvironmentId !== null
      && typeof activeCloudEnvironmentId !== 'string'
    ) {
      throw Http错误工厂.参数错误('当前云端环境格式不正确')
    }

    return 返回数据(await repository.保存UI配置({
      cloudBaseUrl: typeof cloudBaseUrl === 'string' ? cloudBaseUrl : undefined,
      cloudEnvironments: Array.isArray(cloudEnvironments) ? cloudEnvironments : undefined,
      activeCloudEnvironmentId: typeof activeCloudEnvironmentId === 'string' ? activeCloudEnvironmentId : undefined,
    }))
  }))

  return router
}
