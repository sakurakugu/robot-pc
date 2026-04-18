import os from 'node:os'
import { 处理控制器, 返回数据 } from '../../shared/http/controller'
import { Http错误工厂 } from '../../shared/http/errors'
import 配置 from '../../infra/config'
import type { RobotRepository } from './repository'
import type { 保存机器人输入, 工作站接入候选 } from './types'

export class 机器人控制器 {
  constructor(private readonly 仓库: RobotRepository) {}

  getRobotList = 处理控制器(async () => {
    const robots = await this.仓库.listRobots()
    return 返回数据({ robots })
  })

  saveRobot = 处理控制器(async (req) => {
    const body = (req.body ?? {}) as Partial<保存机器人输入>
    if (typeof body.uuid !== 'string' || !body.uuid.trim()) {
      throw Http错误工厂.参数错误('机器人 UUID 不能为空', 'ROBOT_UUID_REQUIRED')
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw Http错误工厂.参数错误('机器人名称不能为空', 'ROBOT_NAME_REQUIRED')
    }
    if (typeof body.ip !== 'string' || !body.ip.trim()) {
      throw Http错误工厂.参数错误('机器人 IP 不能为空', 'ROBOT_IP_REQUIRED')
    }

    const robot = await this.仓库.saveRobot({
      uuid: body.uuid,
      name: body.name,
      ip: body.ip,
      serverUrl: body.serverUrl,
    })

    return 返回数据({ robot }, { 消息: '机器人配置已保存' })
  })

  deleteRobot = 处理控制器(async (req) => {
    const rawUuid = req.params.uuid
    const uuid = Array.isArray(rawUuid) ? rawUuid[0] : rawUuid
    if (!uuid) {
      throw Http错误工厂.参数错误('机器人 UUID 不能为空', 'ROBOT_UUID_REQUIRED')
    }

    const deleted = await this.仓库.deleteRobot(uuid)
    if (!deleted) {
      throw Http错误工厂.未找到('未找到指定机器人', 'ROBOT_NOT_FOUND')
    }

    return 返回数据(undefined, { 消息: '机器人已删除' })
  })

  getAccessInfo = 处理控制器(async (req) => {
    const host = req.hostname || '127.0.0.1'
    const candidates = 构建工作站接入候选(host)
    return 返回数据({
      port: 配置.port,
      businessPath: '/api/v1/web/business',
      candidates,
    })
  })
}

function 构建工作站接入候选(requestHost: string): 工作站接入候选[] {
  const hosts = new Set<string>()
  if (requestHost) {
    hosts.add(requestHost)
  }
  hosts.add('127.0.0.1')
  hosts.add('localhost')

  const interfaces = os.networkInterfaces()
  for (const values of Object.values(interfaces)) {
    for (const item of values ?? []) {
      if (item.family === 'IPv4') {
        hosts.add(item.address)
      }
    }
  }

  return Array.from(hosts)
    .filter((host) => host.trim().length > 0)
    .slice(0, 8)
    .map((host) => ({
      label: host === requestHost ? '当前访问主机' : host === '127.0.0.1' || host === 'localhost' ? '本机回环地址' : '局域网地址',
      host,
      businessUrlTemplate: `ws://${host}:${配置.port}/api/v1/web/business?robotId={robotId}&role=robot`,
    }))
}
