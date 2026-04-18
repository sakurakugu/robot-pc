import fs from 'node:fs/promises'
import path from 'node:path'
import { PNG } from 'pngjs'
import { v7 as uuidv7 } from 'uuid'
import { logger } from '../../infra/logger'
import type { ServerMessage } from '../../shared/types'
import { Http错误工厂 } from '../../shared/http/errors'
import type { RobotRepository } from '../机器人管理/repository'
import type { RobotRecord } from '../机器人管理/types'
import type { 地图元数据, 地图命令请求, 地图命令类型, 地图命令记录, 地图运行状态, 平面位姿, 选中机器人运行信息 } from './types'

interface 地图工作台服务选项 {
  地图目录: string
  机器人仓库: RobotRepository
  发送到机器人: (robotId: string, message: ServerMessage) => boolean
  是否机器人在线: (robotId: string) => boolean
  广播?: (message: ServerMessage) => void
}

interface 地图图片响应 {
  buffer: Buffer
  contentType: string
}

interface 机器人运行态缓存 {
  robotSummary: Record<string, unknown> | null
  navigationState: Record<string, unknown> | null
  mapState: Record<string, unknown> | null
  lastMapResponse: Record<string, unknown> | null
  lastUpdatedAt: string | null
}

interface 待完成地图命令 {
  robotId: string
  resolve: (value: Record<string, unknown>) => void
  reject: (reason?: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

export class 地图工作台服务 {
  private readonly 地图目录: string
  private readonly 机器人仓库: RobotRepository
  private readonly 发送到机器人: (robotId: string, message: ServerMessage) => boolean
  private readonly 是否机器人在线: (robotId: string) => boolean
  private readonly 广播?: (message: ServerMessage) => void
  private readonly 运行状态: 地图运行状态
  private readonly 机器人状态缓存 = new Map<string, 机器人运行态缓存>()
  private readonly 待完成命令 = new Map<string, 待完成地图命令>()

  constructor(选项: 地图工作台服务选项) {
    this.地图目录 = 选项.地图目录
    this.机器人仓库 = 选项.机器人仓库
    this.发送到机器人 = 选项.发送到机器人
    this.是否机器人在线 = 选项.是否机器人在线
    this.广播 = 选项.广播
    this.运行状态 = {
      mode: 'idle',
      activeMapId: null,
      mappingActive: false,
      localizationActive: false,
      currentPose: null,
      goalPose: null,
      lastCommand: null,
      lastCommandAt: null,
      commandHistory: [],
      availableMapCount: 0,
      mapDirectory: this.地图目录,
      telemetrySource: 'stub',
      commandSource: 'stub',
      selectedRobot: null,
    }
  }

  async 初始化(): Promise<void> {
    await fs.mkdir(this.地图目录, { recursive: true })
  }

  async 获取地图列表(): Promise<地图元数据[]> {
    const yaml文件列表 = await 递归收集地图Yaml(this.地图目录)
    const 地图列表 = await Promise.all(yaml文件列表.map(async (yamlPath) => this.解析地图文件(yamlPath)))

    const 有效地图列表 = 地图列表.filter((item): item is 地图元数据 => item !== null)
    有效地图列表.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    this.同步运行状态地图数量(有效地图列表)
    return 有效地图列表
  }

  async 获取运行状态(robotId?: string): Promise<地图运行状态> {
    const 地图列表 = await this.获取地图列表()
    const 基础状态 = this.复制运行状态()
    const 当前地图 = this.获取当前地图(地图列表, 基础状态.activeMapId)

    if (!当前地图 && 基础状态.activeMapId) {
      基础状态.activeMapId = null
      基础状态.localizationActive = false
      基础状态.goalPose = null
      基础状态.currentPose = null
      基础状态.mode = 基础状态.mappingActive ? 'mapping' : 'idle'
    }

    if (!robotId) {
      return 基础状态
    }

    const 机器人 = await this.机器人仓库.getRobot(robotId)
    if (!机器人) {
      throw Http错误工厂.未找到('未找到指定机器人', 'ROBOT_NOT_FOUND')
    }

    const 真实运行态 = await this.读取机器人运行状态(机器人, 地图列表)
    return {
      ...基础状态,
      ...真实运行态,
      commandHistory: [...基础状态.commandHistory],
      commandSource: 真实运行态.commandSource ?? 基础状态.commandSource,
      selectedRobot: 真实运行态.selectedRobot ?? null,
    }
  }

  async 执行命令(请求: 地图命令请求, robotId?: string): Promise<地图运行状态> {
    if (robotId) {
      return this.执行机器人命令(robotId, 请求)
    }

    const 命令 = 请求.command
    const 地图列表 = await this.获取地图列表()
    const 目标地图 = 请求.mapId ? 地图列表.find((item) => item.id === 请求.mapId) : this.获取当前地图(地图列表, this.运行状态.activeMapId)

    switch (命令) {
      case 'start_mapping':
        this.运行状态.mode = 'mapping'
        this.运行状态.mappingActive = true
        this.运行状态.localizationActive = false
        this.运行状态.activeMapId = null
        this.运行状态.currentPose = null
        this.运行状态.goalPose = null
        break
      case 'load_map':
        if (!目标地图) {
          throw Http错误工厂.参数错误('加载地图前请先选择有效地图', 'MAP_REQUIRED')
        }
        this.运行状态.mode = 'map_loaded'
        this.运行状态.mappingActive = false
        this.运行状态.localizationActive = false
        this.运行状态.activeMapId = 目标地图.id
        this.运行状态.currentPose = 创建演示位姿(目标地图, 24, 18, 0.18, 0.72)
        this.运行状态.goalPose = null
        break
      case 'start_localization':
        if (!目标地图) {
          throw Http错误工厂.参数错误('启动定位前请先加载地图', 'MAP_REQUIRED')
        }
        this.运行状态.mode = 'localizing'
        this.运行状态.mappingActive = false
        this.运行状态.localizationActive = true
        this.运行状态.activeMapId = 目标地图.id
        this.运行状态.currentPose = 创建演示位姿(目标地图, 28, 22, 0.36, 0.91)
        this.运行状态.goalPose = 创建演示位姿(目标地图, 62, 36, 1.1, 0.64)
        break
      case 'stop_localization':
        this.运行状态.localizationActive = false
        this.运行状态.goalPose = null
        this.运行状态.mode = this.运行状态.activeMapId ? 'map_loaded' : 'idle'
        break
      default:
        throw Http错误工厂.参数错误('不支持的地图命令', 'UNSUPPORTED_COMMAND')
    }

    this.记录命令(命令, 目标地图?.id ?? null)
    this.广播运行状态()
    return this.获取运行状态()
  }

  async 获取地图图片(mapId: string): Promise<地图图片响应> {
    const 地图列表 = await this.获取地图列表()
    const 地图 = 地图列表.find((item) => item.id === mapId)
    if (!地图) {
      throw Http错误工厂.未找到('未找到指定地图', 'MAP_NOT_FOUND')
    }

    const imagePath = 地图.imagePath
    const ext = path.extname(imagePath).toLowerCase()
    const buffer = await fs.readFile(imagePath)

    if (ext === '.pgm') {
      return {
        buffer: 将Pgm转换为Png(buffer),
        contentType: 'image/png',
      }
    }

    return {
      buffer,
      contentType: 推断图片内容类型(ext),
    }
  }

  处理机器人消息(robotId: string, message: ServerMessage): void {
    const 缓存 = this.机器人状态缓存.get(robotId) ?? 创建空机器人运行态缓存()

    if (message.type === 'robot_summary' && 是对象(message.data)) {
      缓存.robotSummary = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
    }

    if (message.type === 'navigation_state' && 是对象(message.data)) {
      缓存.navigationState = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
    }

    if (message.type === 'map_state' && 是对象(message.data)) {
      缓存.mapState = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
    }

    if (message.type === 'map_response' && 是对象(message.data)) {
      缓存.lastMapResponse = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
      const requestId = typeof message.data.requestId === 'string' ? message.data.requestId : ''
      if (requestId) {
        const pending = this.待完成命令.get(requestId)
        if (pending) {
          this.待完成命令.delete(requestId)
          clearTimeout(pending.timeout)
          pending.resolve(message.data)
        }
      }
    }

    this.机器人状态缓存.set(robotId, 缓存)
  }

  private async 解析地图文件(yamlPath: string): Promise<地图元数据 | null> {
    try {
      const yamlText = await fs.readFile(yamlPath, 'utf8')
      const parsed = 解析地图Yaml内容(yamlText)
      const yamlDir = path.dirname(yamlPath)
      const imagePath = path.isAbsolute(parsed.image)
        ? parsed.image
        : path.resolve(yamlDir, parsed.image)

      const imageStat = await fs.stat(imagePath)
      const yamlRelativePath = path.relative(this.地图目录, yamlPath)
      const id = 生成地图Id(yamlRelativePath)

      return {
        id,
        name: path.basename(yamlPath, path.extname(yamlPath)),
        yamlPath,
        imagePath,
        imageUrl: `/api/v1/mapping/maps/${encodeURIComponent(id)}/image`,
        imageFormat: path.extname(imagePath).slice(1).toLowerCase() || 'unknown',
        resolution: parsed.resolution,
        origin: parsed.origin,
        negate: parsed.negate,
        occupiedThresh: parsed.occupiedThresh,
        freeThresh: parsed.freeThresh,
        updatedAt: imageStat.mtime.toISOString(),
      }
    } catch (error) {
      logger.warn('跳过无法解析的地图文件', {
        yamlPath,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  private 获取当前地图(地图列表: 地图元数据[], activeMapId: string | null): 地图元数据 | null {
    if (!activeMapId) {
      return null
    }
    return 地图列表.find((item) => item.id === activeMapId) ?? null
  }

  private 记录命令(command: 地图命令类型, mapId: string | null): void {
    const timestamp = new Date().toISOString()
    const record: 地图命令记录 = {
      command,
      mapId,
      timestamp,
      status: 'accepted',
    }

    this.运行状态.lastCommand = command
    this.运行状态.lastCommandAt = timestamp
    this.运行状态.commandHistory = [record, ...this.运行状态.commandHistory].slice(0, 8)
  }

  private 同步运行状态地图数量(地图列表: 地图元数据[]): void {
    this.运行状态.availableMapCount = 地图列表.length
  }

  private 广播运行状态(): void {
    this.广播?.({
      type: 'mapping.runtime.updated',
      timestamp: Date.now(),
      data: {
        ...this.运行状态,
        commandHistory: [...this.运行状态.commandHistory],
      },
    })
  }

  private 复制运行状态(): 地图运行状态 {
    return {
      ...this.运行状态,
      commandHistory: [...this.运行状态.commandHistory],
      currentPose: this.运行状态.currentPose ? { ...this.运行状态.currentPose } : null,
      goalPose: this.运行状态.goalPose ? { ...this.运行状态.goalPose } : null,
      telemetrySource: 'stub',
      commandSource: 'stub',
      selectedRobot: null,
    }
  }

  private async 读取机器人运行状态(机器人: RobotRecord, 地图列表: 地图元数据[]): Promise<Partial<地图运行状态>> {
    const wsConnected = this.是否机器人在线(机器人.uuid)
    const serverUrl = 规范化机器人服务地址(机器人)
    const 机器人信息: 选中机器人运行信息 = {
      uuid: 机器人.uuid,
      name: 机器人.name,
      ip: 机器人.ip,
      status: 机器人.status,
      serverUrl,
      wsConnected,
      telemetryOnline: null,
      telemetryFetchedAt: null,
      telemetryAvailableTypes: [],
      telemetryError: null,
    }

    const ws缓存 = this.机器人状态缓存.get(机器人.uuid)
    if (wsConnected && ws缓存) {
      return this.从机器人缓存构建运行状态(机器人信息, ws缓存, 地图列表)
    }

    if (!serverUrl) {
      机器人信息.telemetryError = '未配置 robot-server 地址'
      return {
        telemetrySource: 'stub',
        commandSource: wsConnected ? 'robot_ws' : 'pending_robot',
        selectedRobot: 机器人信息,
      }
    }

    try {
      const telemetry = await 拉取机器人完整遥测(serverUrl)
      const 机器人摘要 = 读取对象(telemetry.robot_summary)
      const 定位状态 = 读取对象(机器人摘要?.localization)
      const 当前位姿 = 解析平面位姿(读取对象(telemetry.navigation_state)?.current_pose, 读取数值(定位状态, 'confidence') ?? 1)
      const 目标位姿 = 解析平面位姿(读取对象(telemetry.navigation_state)?.current_goal, 读取数值(定位状态, 'confidence') ?? 1)
      const 导航状态 = 读取对象(机器人摘要?.navigation)
      const 地图状态 = 读取对象(telemetry.map_state) ?? 读取对象(机器人摘要?.mapping)
      const 当前地图名 = 读取字符串(地图状态, 'current_map') ?? 读取字符串(定位状态, 'map_name')
      const 当前地图 = 当前地图名 ? 地图列表.find((item) => item.name === 当前地图名) ?? null : null
      const localizationState = 读取字符串(定位状态, 'state')
      const navigationState = 读取字符串(导航状态, 'state')
      const mapState = 读取字符串(地图状态, 'state')

      机器人信息.telemetryOnline = 读取布尔值(telemetry, 'online')
      机器人信息.telemetryFetchedAt = new Date().toISOString()
      机器人信息.telemetryAvailableTypes = 读取字符串数组(telemetry.available_types)

      return {
        mode: 推断工作模式(mapState, localizationState, navigationState, 当前地图 ? 当前地图.id : null),
        activeMapId: 当前地图?.id ?? null,
        mappingActive: 是否为建图态(mapState),
        localizationActive: 是否为定位态(localizationState),
        currentPose: 当前位姿,
        goalPose: 目标位姿,
        telemetrySource: 'robot',
        commandSource: wsConnected ? 'robot_ws' : 'pending_robot',
        selectedRobot: 机器人信息,
      }
    } catch (error) {
      机器人信息.telemetryError = error instanceof Error ? error.message : String(error)
      机器人信息.telemetryFetchedAt = new Date().toISOString()
      logger.warn('读取机器人遥测失败，回退为工作站本地桩状态', {
        robotId: 机器人.uuid,
        serverUrl,
        error: 机器人信息.telemetryError,
      })
      return {
        telemetrySource: 'stub',
        commandSource: wsConnected ? 'robot_ws' : 'pending_robot',
        selectedRobot: 机器人信息,
      }
    }
  }

  private 从机器人缓存构建运行状态(
    机器人信息: 选中机器人运行信息,
    缓存: 机器人运行态缓存,
    地图列表: 地图元数据[],
  ): Partial<地图运行状态> {
    const 定位状态 = 读取对象(缓存.robotSummary?.localization)
    const 导航状态摘要 = 读取对象(缓存.robotSummary?.navigation)
    const 地图状态 = 读取对象(缓存.mapState) ?? 读取对象(缓存.robotSummary?.mapping)
    const 当前地图名 = 读取字符串(地图状态, 'current_map') ?? 读取字符串(定位状态, 'map_name')
    const 当前地图 = 当前地图名 ? 地图列表.find((item) => item.name === 当前地图名) ?? null : null
    const localizationState = 读取字符串(定位状态, 'state')
    const navigationState = 读取字符串(导航状态摘要, 'state')
    const mapState = 读取字符串(地图状态, 'state')
    const confidence = 读取数值(定位状态, 'confidence') ?? 1

    机器人信息.telemetryOnline = true
    机器人信息.telemetryFetchedAt = 缓存.lastUpdatedAt
    机器人信息.telemetryAvailableTypes = 可用类型列表(缓存)

    return {
      mode: 推断工作模式(mapState, localizationState, navigationState, 当前地图 ? 当前地图.id : null),
      activeMapId: 当前地图?.id ?? null,
      mappingActive: 是否为建图态(mapState),
      localizationActive: 是否为定位态(localizationState),
      currentPose: 解析平面位姿(读取对象(缓存.navigationState)?.current_pose, confidence),
      goalPose: 解析平面位姿(读取对象(缓存.navigationState)?.current_goal, confidence),
      telemetrySource: 'robot',
      commandSource: 'robot_ws',
      selectedRobot: 机器人信息,
    }
  }

  private async 执行机器人命令(robotId: string, 请求: 地图命令请求): Promise<地图运行状态> {
    const 机器人 = await this.机器人仓库.getRobot(robotId)
    if (!机器人) {
      throw Http错误工厂.未找到('未找到指定机器人', 'ROBOT_NOT_FOUND')
    }

    if (!this.是否机器人在线(robotId)) {
      throw Http错误工厂.参数错误('机器人尚未连接到工作站业务通道', 'ROBOT_WS_OFFLINE')
    }

    const 地图列表 = await this.获取地图列表()
    const 目标地图 = 请求.mapId ? 地图列表.find((item) => item.id === 请求.mapId) ?? null : null
    const requestId = uuidv7()
    const payload = 构建地图命令负载(requestId, 请求.command, 目标地图)

    const responsePromise = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.待完成命令.delete(requestId)
        reject(Http错误工厂.参数错误('等待机器人地图命令响应超时', 'ROBOT_COMMAND_TIMEOUT'))
      }, 5000)

      this.待完成命令.set(requestId, {
        robotId,
        resolve,
        reject,
        timeout,
      })
    })

    const sent = this.发送到机器人(robotId, {
      type: 'map_command',
      robotId,
      timestamp: Date.now(),
      data: payload,
    })

    if (!sent) {
      const pending = this.待完成命令.get(requestId)
      if (pending) {
        clearTimeout(pending.timeout)
        this.待完成命令.delete(requestId)
      }
      throw Http错误工厂.参数错误('机器人业务通道不可用', 'ROBOT_WS_OFFLINE')
    }

    const response = await responsePromise
    if (response.success !== true) {
      throw Http错误工厂.参数错误(
        typeof response.error === 'string' ? response.error : '机器人执行地图命令失败',
        typeof response.errorCode === 'string' ? response.errorCode : 'ROBOT_COMMAND_FAILED',
      )
    }

    return this.获取运行状态(robotId)
  }
}

async function 拉取机器人完整遥测(serverUrl: string): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 2500)

  try {
    const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/v1/telemetry/full`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`robot-server 响应失败 (${response.status})`)
    }

    const payload = await response.json() as { success?: boolean; data?: unknown; error?: string }
    if (!payload.success || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
      throw new Error(payload.error || 'robot-server 返回了无效遥测数据')
    }

    return payload.data as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('读取 robot-server 遥测超时')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function 创建空机器人运行态缓存(): 机器人运行态缓存 {
  return {
    robotSummary: null,
    navigationState: null,
    mapState: null,
    lastMapResponse: null,
    lastUpdatedAt: null,
  }
}

function 可用类型列表(缓存: 机器人运行态缓存): string[] {
  const types: string[] = []
  if (缓存.robotSummary) {
    types.push('robot_summary')
  }
  if (缓存.navigationState) {
    types.push('navigation_state')
  }
  if (缓存.mapState) {
    types.push('map_state')
  }
  if (缓存.lastMapResponse) {
    types.push('map_response')
  }
  return types
}

function 构建地图命令负载(
  requestId: string,
  command: 地图命令类型,
  map: 地图元数据 | null,
): Record<string, unknown> {
  switch (command) {
    case 'start_mapping':
      return {
        requestId,
        command: 'start_mapping',
        map_name: map?.name,
      }
    case 'load_map':
      return {
        requestId,
        command: 'load_map',
        map_name: map?.name,
      }
    case 'start_localization':
      return {
        requestId,
        command: 'start_localization',
        map_name: map?.name,
      }
    case 'stop_localization':
      return {
        requestId,
        command: 'stop_localization',
      }
    default:
      return {
        requestId,
        command,
      }
  }
}

function 规范化机器人服务地址(机器人: RobotRecord): string | null {
  if (机器人.serverUrl && 机器人.serverUrl.trim().length > 0) {
    return 机器人.serverUrl.trim()
  }
  if (机器人.ip.trim().length > 0) {
    return `http://${机器人.ip}:8080`
  }
  return null
}

function 解析平面位姿(value: unknown, confidence: number): 平面位姿 | null {
  const pose = 读取对象(value)
  const position = 读取三元数值数组(pose?.position)
  const orientation = 读取四元数值数组(pose?.orientation)
  if (!position || !orientation) {
    return null
  }

  return {
    position,
    orientation,
    yaw: 从四元数解析偏航角(orientation),
    confidence: 保留两位小数(confidence),
  }
}

function 从四元数解析偏航角(orientation: [number, number, number, number]): number {
  const [x, y, z, w] = orientation
  const siny = 2 * (w * z + x * y)
  const cosy = 1 - 2 * (y * y + z * z)
  return 保留三位小数(Math.atan2(siny, cosy))
}

function 推断工作模式(
  mapState: string | null,
  localizationState: string | null,
  navigationState: string | null,
  activeMapId: string | null,
): 'idle' | 'mapping' | 'map_loaded' | 'localizing' {
  if (是否为建图态(mapState)) {
    return 'mapping'
  }
  if (是否为定位态(localizationState) || 是否为定位态(navigationState)) {
    return 'localizing'
  }
  if (activeMapId) {
    return 'map_loaded'
  }
  return 'idle'
}

function 是否为建图态(state: string | null): boolean {
  if (!state) {
    return false
  }
  return ['mapping', 'building', 'running', 'active'].some((keyword) => state.toLowerCase().includes(keyword))
}

function 是否为定位态(state: string | null): boolean {
  if (!state) {
    return false
  }
  return ['localized', 'localizing', 'running', 'active', 'tracking'].some((keyword) => state.toLowerCase().includes(keyword))
}

function 读取对象(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function 是对象(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function 读取字符串(value: Record<string, unknown> | null | undefined, key: string): string | null {
  const target = value?.[key]
  if (typeof target !== 'string') {
    return null
  }
  const text = target.trim()
  return text.length > 0 ? text : null
}

function 读取布尔值(value: Record<string, unknown>, key: string): boolean | null {
  const target = value[key]
  return typeof target === 'boolean' ? target : null
}

function 读取数值(value: Record<string, unknown> | null | undefined, key: string): number | null {
  const target = value?.[key]
  const numberValue = typeof target === 'number' ? target : Number(target)
  return Number.isFinite(numberValue) ? numberValue : null
}

function 读取三元数值数组(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) {
    return null
  }

  const numbers = value.slice(0, 3).map((item) => Number(item))
  if (numbers.some((item) => !Number.isFinite(item))) {
    return null
  }

  return [numbers[0], numbers[1], numbers[2]]
}

function 读取四元数值数组(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) {
    return null
  }

  const numbers = value.slice(0, 4).map((item) => Number(item))
  if (numbers.some((item) => !Number.isFinite(item))) {
    return null
  }

  return [numbers[0], numbers[1], numbers[2], numbers[3]]
}

function 读取字符串数组(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

async function 递归收集地图Yaml(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await 递归收集地图Yaml(fullPath))
      continue
    }

    if (entry.isFile() && /\.(yaml|yml)$/i.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function 解析地图Yaml内容(text: string): {
  image: string
  resolution: number
  origin: [number, number, number]
  negate: number
  occupiedThresh: number
  freeThresh: number
} {
  const image = 读取Yaml字符串字段(text, 'image')
  const resolution = 读取Yaml数字字段(text, 'resolution')
  const origin = 读取Yaml数组字段(text, 'origin')
  const negate = 读取Yaml数字字段(text, 'negate', 0)
  const occupiedThresh = 读取Yaml数字字段(text, 'occupied_thresh', 0.65)
  const freeThresh = 读取Yaml数字字段(text, 'free_thresh', 0.196)

  return {
    image,
    resolution,
    origin,
    negate,
    occupiedThresh,
    freeThresh,
  }
}

function 读取Yaml字符串字段(text: string, key: string): string {
  const matched = text.match(new RegExp(`^${转义正则(key)}\\s*:\\s*(.+)$`, 'm'))
  if (!matched) {
    throw new Error(`缺少字段: ${key}`)
  }
  const value = matched[1].split('#')[0].trim()
  return 去除包裹引号(value)
}

function 读取Yaml数字字段(text: string, key: string, fallback?: number): number {
  const matched = text.match(new RegExp(`^${转义正则(key)}\\s*:\\s*([^#\\r\\n]+)`, 'm'))
  if (!matched) {
    if (fallback !== undefined) {
      return fallback
    }
    throw new Error(`缺少字段: ${key}`)
  }

  const value = Number.parseFloat(matched[1].trim())
  if (!Number.isFinite(value)) {
    throw new Error(`字段 ${key} 不是有效数字`)
  }
  return value
}

function 读取Yaml数组字段(text: string, key: string): [number, number, number] {
  const matched = text.match(new RegExp(`^${转义正则(key)}\\s*:\\s*\\[([^\\]]+)\\]`, 'm'))
  if (!matched) {
    throw new Error(`缺少数组字段: ${key}`)
  }

  const values = matched[1]
    .split(',')
    .map((item) => Number.parseFloat(item.trim()))

  if (values.length !== 3 || values.some((item) => !Number.isFinite(item))) {
    throw new Error(`字段 ${key} 不是有效的三元数组`)
  }

  return [values[0], values[1], values[2]]
}

function 去除包裹引号(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return value.slice(1, -1)
  }
  return value
}

function 转义正则(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function 生成地图Id(relativeYamlPath: string): string {
  return relativeYamlPath
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/]+/g, '--')
}

function 创建演示位姿(map: 地图元数据, xGrid: number, yGrid: number, yaw: number, confidence: number): 平面位姿 {
  const x = map.origin[0] + xGrid * map.resolution
  const y = map.origin[1] + yGrid * map.resolution

  return {
    position: [保留三位小数(x), 保留三位小数(y), 0],
    orientation: 由偏航角生成四元数(yaw),
    yaw: 保留三位小数(yaw),
    confidence: 保留两位小数(confidence),
  }
}

function 由偏航角生成四元数(yaw: number): [number, number, number, number] {
  const halfYaw = yaw / 2
  const z = Math.sin(halfYaw)
  const w = Math.cos(halfYaw)
  return [0, 0, 保留六位小数(z), 保留六位小数(w)]
}

function 保留两位小数(value: number): number {
  return Number(value.toFixed(2))
}

function 保留三位小数(value: number): number {
  return Number(value.toFixed(3))
}

function 保留六位小数(value: number): number {
  return Number(value.toFixed(6))
}

function 推断图片内容类型(ext: string): string {
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

function 将Pgm转换为Png(buffer: Buffer): Buffer {
  const parsed = 解析Pgm(buffer)
  const png = new PNG({
    width: parsed.width,
    height: parsed.height,
  })

  for (let index = 0; index < parsed.pixels.length; index += 1) {
    const value = parsed.pixels[index]
    const rgbaIndex = index * 4
    png.data[rgbaIndex] = value
    png.data[rgbaIndex + 1] = value
    png.data[rgbaIndex + 2] = value
    png.data[rgbaIndex + 3] = 255
  }

  return PNG.sync.write(png)
}

function 解析Pgm(buffer: Buffer): { width: number; height: number; pixels: Uint8Array } {
  let cursor = 0
  const readToken = (): string => {
    while (cursor < buffer.length) {
      const current = buffer[cursor]
      if (current === 35) {
        while (cursor < buffer.length && buffer[cursor] !== 10) {
          cursor += 1
        }
        continue
      }
      if (current === 9 || current === 10 || current === 13 || current === 32) {
        cursor += 1
        continue
      }
      break
    }

    const start = cursor
    while (cursor < buffer.length) {
      const current = buffer[cursor]
      if (current === 9 || current === 10 || current === 13 || current === 32 || current === 35) {
        break
      }
      cursor += 1
    }
    return buffer.toString('ascii', start, cursor)
  }

  const magic = readToken()
  const width = Number.parseInt(readToken(), 10)
  const height = Number.parseInt(readToken(), 10)
  const maxValue = Number.parseInt(readToken(), 10)

  if (!['P2', 'P5'].includes(magic)) {
    throw new Error('仅支持 P2/P5 格式的 PGM 图片')
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('PGM 尺寸无效')
  }
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    throw new Error('PGM 最大灰度值无效')
  }

  const pixelCount = width * height
  if (magic === 'P5') {
    while (cursor < buffer.length && [9, 10, 13, 32].includes(buffer[cursor])) {
      cursor += 1
    }

    const raw = buffer.subarray(cursor, cursor + pixelCount)
    if (raw.length !== pixelCount) {
      throw new Error('PGM 像素数据长度不正确')
    }

    if (maxValue === 255) {
      return {
        width,
        height,
        pixels: Uint8Array.from(raw),
      }
    }

    return {
      width,
      height,
      pixels: Uint8Array.from(raw, (item) => Math.round((item / maxValue) * 255)),
    }
  }

  const pixels = new Uint8Array(pixelCount)
  for (let index = 0; index < pixelCount; index += 1) {
    const value = Number.parseInt(readToken(), 10)
    if (!Number.isFinite(value)) {
      throw new Error('PGM 像素数据不完整')
    }
    pixels[index] = Math.round((value / maxValue) * 255)
  }

  return { width, height, pixels }
}
