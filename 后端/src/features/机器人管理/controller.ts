import { 处理控制器, 返回数据 } from '../../shared/http/controller'
import type { RobotRepository } from './repository'

export class 机器人控制器 {
  constructor(private readonly 仓库: RobotRepository) {}

  getRobotList = 处理控制器(async () => {
    const robots = await this.仓库.listRobots()
    return 返回数据({ robots })
  })
}
