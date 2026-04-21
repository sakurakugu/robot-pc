import { Router } from 'express'
import type { 地图工作台控制器 } from './controller'

export function createMappingRoutes(controller: 地图工作台控制器): Router {
  const router = Router()
  router.get('/maps', controller.获取地图列表)
  router.get('/waypoints', controller.获取巡逻文件列表)
  router.get('/waypoints/:waypointId', controller.获取巡逻文件详情)
  router.get('/runtime', controller.获取运行状态)
  router.post('/open-map-directory', controller.打开地图目录)
  router.post('/open-waypoint-directory', controller.打开巡逻目录)
  router.post('/commands', controller.执行命令)
  router.get('/maps/:mapId/image', (req, res, next) => {
    void controller.获取地图图片(req, res).catch(next)
  })
  return router
}
