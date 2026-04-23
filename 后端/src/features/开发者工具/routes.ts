import { Router } from 'express'
import { 返回数据, 处理控制器 } from '../../shared/http/controller'
import { 开发者工具服务 } from './service'
import type { 启动本体工具任务请求 } from './types'

export function createDeveloperRoutes(service = new 开发者工具服务()): Router {
  const router = Router()

  router.get('/onboard-tools/info', 处理控制器(async () => 返回数据(service.获取本体工具信息())))
  router.get('/onboard-tools/jobs', 处理控制器(async () => 返回数据({ jobs: service.获取任务列表() })))
  router.get('/onboard-tools/jobs/:jobId', 处理控制器(async (req) => 返回数据(
    service.获取任务记录(String(req.params.jobId || '')),
  )))
  router.post('/onboard-tools/jobs', 处理控制器(async (req) => 返回数据(
    service.启动本体工具任务((req.body ?? {}) as 启动本体工具任务请求),
    { 状态码: 202, 消息: '开发者工具任务已启动' },
  )))

  return router
}
