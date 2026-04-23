import os from 'node:os'
import { 处理控制器, 返回数据 } from '../../shared/http/controller'
import { Http错误工厂 } from '../../shared/http/errors'
import 配置 from '../../infra/config'
import { 诊断机器人连接 } from './diagnosis'
import { 扫描局域网机器人 } from './mdns-discovery'
import type { RobotRepository } from './repository'
import type { 保存机器人输入, 工作站接入候选, 机器人遥测数据 } from './types'

export class 机器人控制器 {
  constructor(
    private readonly 仓库: RobotRepository,
    private readonly 是否机器人在线: (robotId: string) => boolean = () => false,
  ) {}

  getRobotList = 处理控制器(async () => {
    const robots = await this.仓库.listRobots()
    return 返回数据({ robots })
  })

  discoverRobots = 处理控制器(async (req) => {
    const timeoutSeconds = 解析扫描超时(req.query.timeoutSeconds)
    const robots = await 扫描局域网机器人(timeoutSeconds)
    return 返回数据({ robots })
  })

  saveRobot = 处理控制器(async (req) => {
    const body = (req.body ?? {}) as Partial<保存机器人输入>
    if (typeof body.uuid !== 'string' || !body.uuid.trim()) {
      throw Http错误工厂.参数错误('机器人 UUID 不能为空', 'ROBOT_UUID_REQUIRED')
    }
    if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some((item) => typeof item !== 'string'))) {
      throw Http错误工厂.参数错误('机器人标签格式不正确', 'ROBOT_TAGS_INVALID')
    }

    const robot = await this.仓库.saveRobot({
      uuid: body.uuid,
      name: body.name,
      model: body.model,
      ip: body.ip,
      group_name: body.group_name,
      tags: body.tags,
      sn: body.sn,
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

  getRobotDiagnosis = 处理控制器(async (req) => {
    const rawUuid = req.params.uuid
    const uuid = Array.isArray(rawUuid) ? rawUuid[0] : rawUuid
    if (!uuid) {
      throw Http错误工厂.参数错误('机器人 UUID 不能为空', 'ROBOT_UUID_REQUIRED')
    }

    const robot = await this.仓库.getRobot(uuid)
    if (!robot) {
      throw Http错误工厂.未找到('未找到指定机器人', 'ROBOT_NOT_FOUND')
    }

    const diagnosis = await 诊断机器人连接(robot, this.是否机器人在线(uuid))
    return 返回数据({ diagnosis })
  })

  getRobotTelemetry = 处理控制器(async (req) => {
    const rawUuid = req.params.uuid
    const uuid = Array.isArray(rawUuid) ? rawUuid[0] : rawUuid
    if (!uuid) {
      throw Http错误工厂.参数错误('机器人 UUID 不能为空', 'ROBOT_UUID_REQUIRED')
    }

    const robot = await this.仓库.getRobot(uuid)
    if (!robot) {
      throw Http错误工厂.未找到('未找到指定机器人', 'ROBOT_NOT_FOUND')
    }

    const serverUrl = 规范化机器人服务地址(robot.serverUrl) || (robot.ip ? `http://${robot.ip}:8080` : null)
    if (!serverUrl) {
      throw Http错误工厂.参数错误('机器人缺少 robot-server 地址或 IP', 'ROBOT_SERVER_URL_REQUIRED')
    }

    const data = await 拉取机器人遥测(serverUrl)
    return 返回数据({ telemetry: data })
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

function 解析扫描超时(value: unknown): number {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (rawValue === undefined) {
    return 3
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 15) {
    throw Http错误工厂.参数错误('扫描超时时间必须在 1 到 15 秒之间', 'ROBOT_DISCOVERY_TIMEOUT_INVALID')
  }

  return Math.floor(parsed)
}

function 规范化机器人服务地址(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed || null
}

async function 拉取机器人遥测(serverUrl: string): Promise<机器人遥测数据> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch(`${serverUrl}/api/v1/telemetry`, {
      signal: controller.signal,
    })
    if (!response.ok) {
      throw Http错误工厂.上游错误(`机器人遥测接口异常：HTTP ${response.status}`, 'ROBOT_TELEMETRY_HTTP_ERROR')
    }

    const payload = await response.json() as { data?: Record<string, unknown> }
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
    return {
      ...data,
      online: Boolean(data.online),
      power: typeof data.power === 'number' ? data.power : null,
      temp: typeof data.temp === 'number' ? data.temp : null,
      model: typeof data.model === 'string' ? data.model : null,
      dev_name: typeof data.dev_name === 'string' ? data.dev_name : null,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw Http错误工厂.上游错误('机器人遥测接口超时', 'ROBOT_TELEMETRY_TIMEOUT')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
