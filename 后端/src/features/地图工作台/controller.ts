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

  获取机器人地图列表 = 处理控制器(async (req) => {
    const maps = await this.服务.获取机器人地图列表(this.读取机器人ID必填(req))
    return 返回数据(maps)
  })

  下载机器人地图 = 处理控制器(async (req) => {
    const result = await this.服务.下载机器人地图(
      this.读取机器人ID必填(req),
      this.读取路径参数(req.params.mapId, '远程地图 ID'),
    )
    return 返回数据(result, { 消息: '地图已下载到本地仓库' })
  })

  获取巡逻文件列表 = 处理控制器(async () => {
    const waypoints = await this.服务.获取巡逻文件列表()
    return 返回数据({ waypoints })
  })

  获取巡逻文件详情 = 处理控制器(async (req) => {
    const waypoint = await this.服务.获取巡逻文件详情(this.读取路径参数(req.params.waypointId, '巡逻文件 ID'))
    return 返回数据({ waypoint })
  })

  获取运行状态 = 处理控制器(async (req) => {
    const runtime = await this.服务.获取运行状态(this.读取机器人ID(req))
    return 返回数据(runtime)
  })

  打开地图目录 = 处理控制器(async () => {
    await this.服务.打开地图目录()
    return 返回数据(undefined, { 消息: '地图目录已打开' })
  })

  打开巡逻目录 = 处理控制器(async () => {
    await this.服务.打开巡逻目录()
    return 返回数据(undefined, { 消息: '巡逻目录已打开' })
  })

  执行命令 = 处理控制器(async (req) => {
    const body = (req.body ?? {}) as 地图命令请求
    if (typeof body.command !== 'string' || body.command.length === 0) {
      throw Http错误工厂.参数错误('命令不能为空', 'COMMAND_REQUIRED')
    }

    const normalizedBody = typeof (body as { type?: unknown }).type === 'string'
      ? body
      : { ...body, type: 'map' } as 地图命令请求

    const runtime = await this.服务.执行命令(normalizedBody, this.读取机器人ID(req))
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

  private 读取机器人ID必填(req: Request): string {
    const robotId = this.读取机器人ID(req)
    if (!robotId) {
      throw Http错误工厂.参数错误('机器人 ID 不能为空', 'ROBOT_ID_REQUIRED')
    }
    return robotId
  }

  private 读取路径参数(rawValue: string | string[] | undefined, 字段标签: string): string {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw Http错误工厂.参数错误(`${字段标签}不能为空`, 'PATH_PARAM_REQUIRED')
    }
    return value.trim()
  }
}
