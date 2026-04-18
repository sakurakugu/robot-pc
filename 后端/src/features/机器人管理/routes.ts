import { Router } from 'express'
import type { 机器人控制器 } from './controller'

export function createRobotRoutes(controller: 机器人控制器): Router {
  const router = Router()
  router.get('/', controller.getRobotList)
  router.get('/access-info', controller.getAccessInfo)
  router.get('/:uuid/diagnosis', controller.getRobotDiagnosis)
  router.post('/', controller.saveRobot)
  router.put('/:uuid', controller.saveRobot)
  router.delete('/:uuid', controller.deleteRobot)
  return router
}
