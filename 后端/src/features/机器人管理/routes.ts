import { Router } from 'express'
import type { 机器人控制器 } from './controller'

export function createRobotRoutes(controller: 机器人控制器): Router {
  const router = Router()
  router.get('/', controller.getRobotList)
  return router
}
