import type { Request, Response } from 'express'
import { 处理控制器, 返回数据 } from '../../shared/http/controller'
import { Http错误工厂 } from '../../shared/http/errors'
import type { 地图工作台服务 } from './service'
import type { 地图命令请求 } from './types'

export class 地图工作台控制器 {
  constructor(private readonly 服务: 地图工作台服务) {}

  获取地图列表 = 处理控制器(async () => {
    const maps = await this.服务.获取地图列表()
    return 返回数据({ maps })
  })

  获取运行状态 = 处理控制器(async (req) => {
    const runtime = await this.服务.获取运行状态(this.读取机器人ID(req))
    return 返回数据(runtime)
  })

  执行命令 = 处理控制器(async (req) => {
    const body = (req.body ?? {}) as 地图命令请求
    if (typeof body.command !== 'string' || body.command.length === 0) {
      throw Http错误工厂.参数错误('命令不能为空', 'COMMAND_REQUIRED')
    }

    const runtime = await this.服务.执行命令(body, this.读取机器人ID(req))
    return 返回数据(runtime, { 消息: '地图命令已接受' })
  })

  获取地图图片 = async (req: Request, res: Response): Promise<void> => {
    const rawMapId = req.params.mapId
    const mapId = Array.isArray(rawMapId) ? rawMapId[0] : rawMapId
    if (!mapId) {
      throw Http错误工厂.参数错误('地图 ID 不能为空', 'MAP_ID_REQUIRED')
    }

    const image = await this.服务.获取地图图片(mapId)
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'no-cache')
    res.send(image.buffer)
  }

  private 读取机器人ID(req: Request): string | undefined {
    const rawRobotId = req.query.robotId
    const robotId = Array.isArray(rawRobotId) ? rawRobotId[0] : rawRobotId
    return typeof robotId === 'string' && robotId.trim().length > 0 ? robotId.trim() : undefined
  }
}
