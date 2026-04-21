import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { PNG } from 'pngjs'
import { v7 as uuidv7 } from 'uuid'
import { logger } from '../../infra/logger'
import type { ServerMessage } from '../../shared/types'
import { Http错误工厂 } from '../../shared/http/errors'
import type { RobotRepository } from '../机器人管理/repository'
import type { RobotRecord } from '../机器人管理/types'
import type {
  传感器状态信息,
  地图元数据,
  巡逻文件详情,
  巡逻文件元数据,
  巡逻点详情,
  地图命令类型,
  地图命令记录,
  地图运行状态,
  导航目标,
  工作台命令请求,
  运行时命令通道,
  运行时命令类型,
  平面位姿,
  激光扫描数据,
  机器人摘要信息,
  运行时任务信息,
  运行时地图信息,
  运行时导航信息,
  选中机器人运行信息,
} from './types'

interface 地图工作台服务选项 {
  地图目录: string
  巡逻目录: string
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
  robotSummary: 机器人摘要信息 | null
  navigationState: 运行时导航信息 | null
  mapState: 运行时地图信息 | null
  taskState: 运行时任务信息 | null
  sensorState: 传感器状态信息 | null
  lastMapResponse: Record<string, unknown> | null
  lastNavigationResponse: Record<string, unknown> | null
  lastPatrolResponse: Record<string, unknown> | null
  lidarScan: 激光扫描数据 | null
  lastUpdatedAt: string | null
}

interface 待完成运行时命令 {
  robotId: string
  resolve: (value: Record<string, unknown>) => void
  reject: (reason?: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

export class 地图工作台服务 {
  private readonly 地图目录: string
  private readonly 巡逻目录: string
  private readonly 机器人仓库: RobotRepository
  private readonly 发送到机器人: (robotId: string, message: ServerMessage) => boolean
  private readonly 是否机器人在线: (robotId: string) => boolean
  private readonly 广播?: (message: ServerMessage) => void
  private readonly 运行状态: 地图运行状态
  private readonly 机器人状态缓存 = new Map<string, 机器人运行态缓存>()
  private readonly 待完成命令 = new Map<string, 待完成运行时命令>()

  constructor(选项: 地图工作台服务选项) {
    this.地图目录 = 选项.地图目录
    this.巡逻目录 = 选项.巡逻目录
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
      lidarScan: null,
      lastCommand: null,
      lastCommandAt: null,
      commandHistory: [],
      availableMapCount: 0,
      mapDirectory: this.地图目录,
      telemetrySource: 'stub',
      commandSource: 'stub',
      selectedRobot: null,
      robotSummary: null,
      navigationState: null,
      mapState: null,
      taskState: null,
      sensorState: null,
    }
  }

  async 初始化(): Promise<void> {
    await fs.mkdir(this.地图目录, { recursive: true })
    await fs.mkdir(this.巡逻目录, { recursive: true })
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

  async 打开地图目录(): Promise<void> {
    await fs.mkdir(this.地图目录, { recursive: true })
    await 打开系统目录(this.地图目录)
  }

  async 获取巡逻文件列表(): Promise<巡逻文件元数据[]> {
    await fs.mkdir(this.巡逻目录, { recursive: true })
    const 文件列表 = await 递归收集巡逻Json(this.巡逻目录)
    const 结果 = await Promise.all(文件列表.map(async (filePath) => {
      const stat = await fs.stat(filePath)
      return {
        id: 生成巡逻文件Id(path.relative(this.巡逻目录, filePath)),
        name: path.basename(filePath, path.extname(filePath)),
        path: filePath,
        updatedAt: stat.mtime.toISOString(),
      } satisfies 巡逻文件元数据
    }))

    结果.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return 结果
  }

  async 获取巡逻文件详情(waypointId: string): Promise<巡逻文件详情> {
    await fs.mkdir(this.巡逻目录, { recursive: true })
    const filePath = await this.查找巡逻文件路径(waypointId)
    return this.读取巡逻文件详情(filePath)
  }

  async 打开巡逻目录(): Promise<void> {
    await fs.mkdir(this.巡逻目录, { recursive: true })
    await 打开系统目录(this.巡逻目录)
  }

  private async 查找巡逻文件路径(waypointId: string): Promise<string> {
    const 文件列表 = await 递归收集巡逻Json(this.巡逻目录)
    const 命中文件 = 文件列表.find((filePath) => {
      const relativePath = path.relative(this.巡逻目录, filePath)
      return 生成巡逻文件Id(relativePath) === waypointId
    })

    if (!命中文件) {
      throw Http错误工厂.未找到('未找到指定巡逻文件', 'WAYPOINT_FILE_NOT_FOUND')
    }

    return 命中文件
  }

  private async 读取巡逻文件详情(filePath: string): Promise<巡逻文件详情> {
    const [文件状态, 文件内容] = await Promise.all([
      fs.stat(filePath),
      fs.readFile(filePath, 'utf8'),
    ])
    const relativePath = path.relative(this.巡逻目录, filePath)
    const 基础信息 = 解析巡逻文件内容(文件内容, path.basename(filePath, path.extname(filePath)))

    return {
      id: 生成巡逻文件Id(relativePath),
      name: 基础信息.name,
      path: filePath,
      updatedAt: 文件状态.mtime.toISOString(),
      mapName: 基础信息.mapName,
      loop: 基础信息.loop,
      arrivalWaitSec: 基础信息.arrivalWaitSec,
      waypointCount: 基础信息.waypoints.length,
      waypoints: 基础信息.waypoints,
    }
  }

  async 执行命令(请求: 工作台命令请求, robotId?: string): Promise<地图运行状态> {
    if (robotId) {
      return this.执行机器人命令(robotId, 请求)
    }

    const 地图列表 = await this.获取地图列表()
    switch (请求.type) {
      case 'map':
        this.执行本地地图命令(请求, 地图列表)
        break
      case 'navigation':
        this.执行本地导航命令(请求, 地图列表)
        break
      case 'patrol':
        await this.执行本地巡逻命令(请求, 地图列表)
        break
      default:
        throw Http错误工厂.参数错误('不支持的工作台命令类型', 'UNSUPPORTED_COMMAND_TYPE')
    }

    this.同步本地桩详情(地图列表)
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

    if (message.type === 'task_state' && 是对象(message.data)) {
      缓存.taskState = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
    }

    if (message.type === 'sensor_state' && 是对象(message.data)) {
      缓存.sensorState = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
    }

    if (message.type === 'map_response' && 是对象(message.data)) {
      缓存.lastMapResponse = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
      this.处理命令响应(message.data)
    }

    if (message.type === 'navigation_response' && 是对象(message.data)) {
      缓存.lastNavigationResponse = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
      this.处理命令响应(message.data)
    }

    if (message.type === 'patrol_response' && 是对象(message.data)) {
      缓存.lastPatrolResponse = { ...message.data }
      缓存.lastUpdatedAt = new Date().toISOString()
      this.处理命令响应(message.data)
    }

    if (message.type === 'lidar_scan' && 是对象(message.data)) {
      const lidarScan = 解析激光扫描(message.data)
      缓存.lidarScan = lidarScan
      缓存.lastUpdatedAt = new Date().toISOString()
      if (lidarScan) {
        this.广播?.({
          type: 'mapping.lidar_scan.updated',
          robotId,
          timestamp: Date.now(),
          data: {
            robotId,
            scan: 复制激光扫描(lidarScan),
          },
        })
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

  private 解析请求目标地图(请求: 工作台命令请求, 地图列表: 地图元数据[]): 地图元数据 | null {
    if (请求.type === 'map' && 请求.mapId) {
      return 地图列表.find((item) => item.id === 请求.mapId) ?? null
    }

    const 目标地图名 =
      请求.type === 'map'
        ? 请求.mapName
        : 请求.type === 'navigation'
          ? 请求.goal?.mapName ?? null
          : null

    if (typeof 目标地图名 === 'string' && 目标地图名.trim().length > 0) {
      return 地图列表.find((item) => item.name === 目标地图名.trim()) ?? null
    }

    return this.获取当前地图(地图列表, this.运行状态.activeMapId)
  }

  private 执行本地地图命令(请求: Extract<工作台命令请求, { type: 'map' }>, 地图列表: 地图元数据[]): void {
    const 命令 = 请求.command
    const 目标地图 = this.解析请求目标地图(请求, 地图列表)

    switch (命令) {
      case 'start_mapping':
        this.运行状态.mode = 'mapping'
        this.运行状态.mappingActive = true
        this.运行状态.localizationActive = false
        this.运行状态.activeMapId = null
        this.运行状态.currentPose = null
        this.运行状态.goalPose = null
        this.运行状态.taskState = null
        break
      case 'stop_mapping':
        this.运行状态.mappingActive = false
        this.运行状态.localizationActive = false
        this.运行状态.goalPose = null
        this.运行状态.mode = 目标地图 ? 'map_loaded' : 'idle'
        this.运行状态.activeMapId = 目标地图?.id ?? this.运行状态.activeMapId
        this.运行状态.taskState = null
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
        this.运行状态.taskState = null
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
        this.运行状态.goalPose = null
        this.运行状态.taskState = null
        break
      case 'stop_localization':
        this.运行状态.localizationActive = false
        this.运行状态.goalPose = null
        this.运行状态.mode = this.运行状态.activeMapId ? 'map_loaded' : 'idle'
        this.运行状态.taskState = null
        break
      default:
        throw Http错误工厂.参数错误('不支持的地图命令', 'UNSUPPORTED_COMMAND')
    }

    this.记录运行时命令('map', 命令, 目标地图?.id ?? null)
  }

  private 执行本地导航命令(请求: Extract<工作台命令请求, { type: 'navigation' }>, 地图列表: 地图元数据[]): void {
    const 当前地图 = this.解析请求目标地图(请求, 地图列表)

    switch (请求.command) {
      case 'navigate_to':
        if (!请求.goal) {
          throw Http错误工厂.参数错误('导航目标不能为空', 'GOAL_REQUIRED')
        }
        if (!当前地图) {
          throw Http错误工厂.参数错误('导航前请先加载地图', 'MAP_REQUIRED')
        }
        this.运行状态.activeMapId = 当前地图.id
        this.运行状态.mode = 'localizing'
        this.运行状态.localizationActive = true
        this.运行状态.mappingActive = false
        if (!this.运行状态.currentPose) {
          this.运行状态.currentPose = 创建演示位姿(当前地图, 28, 22, 0.36, 0.91)
        }
        this.运行状态.goalPose = 由导航目标创建位姿(请求.goal)
        this.运行状态.taskState = {
          state: 'running',
          task_type: 'navigation',
          task_id: `stub-navigation-${Date.now()}`,
        }
        break
      case 'cancel':
      case 'terminate':
        this.运行状态.goalPose = null
        this.运行状态.taskState = this.运行状态.taskState?.task_type === 'patrol'
          ? this.运行状态.taskState
          : null
        break
      case 'pause':
        if (!this.运行状态.taskState) {
          throw Http错误工厂.参数错误('当前没有活动中的任务', 'TASK_NOT_ACTIVE')
        }
        this.运行状态.taskState = {
          ...this.运行状态.taskState,
          state: 'paused',
        }
        break
      case 'resume':
        if (!this.运行状态.taskState) {
          throw Http错误工厂.参数错误('当前没有可恢复的任务', 'TASK_NOT_ACTIVE')
        }
        this.运行状态.taskState = {
          ...this.运行状态.taskState,
          state: 'running',
        }
        break
      default:
        throw Http错误工厂.参数错误('不支持的导航命令', 'UNSUPPORTED_COMMAND')
    }

    this.记录运行时命令('navigation', 请求.command, 当前地图?.id ?? this.运行状态.activeMapId)
  }

  private async 执行本地巡逻命令(请求: Extract<工作台命令请求, { type: 'patrol' }>, 地图列表: 地图元数据[]): Promise<void> {
    const 当前地图 = this.获取当前地图(地图列表, this.运行状态.activeMapId)

    switch (请求.command) {
      case 'start_patrol': {
        if (!请求.waypointFile || requestIsBlank(请求.waypointFile)) {
          throw Http错误工厂.参数错误('巡逻点位文件不能为空', 'WAYPOINT_FILE_REQUIRED')
        }
        const 巡逻文件 = await this.读取巡逻文件详情(请求.waypointFile.trim())
        const 第一路点 = 巡逻文件.waypoints[0]
        if (!第一路点) {
          throw Http错误工厂.参数错误('巡逻文件中没有可执行的路点', 'WAYPOINT_FILE_EMPTY')
        }

        const 路线地图 = 巡逻文件.mapName
          ? 地图列表.find((item) => item.name === 巡逻文件.mapName) ?? 当前地图
          : 当前地图

        this.运行状态.activeMapId = 路线地图?.id ?? this.运行状态.activeMapId
        this.运行状态.mode = this.运行状态.activeMapId ? 'localizing' : this.运行状态.mode
        this.运行状态.localizationActive = this.运行状态.activeMapId !== null
        this.运行状态.mappingActive = false
        if (!this.运行状态.currentPose && 路线地图) {
          this.运行状态.currentPose = 创建演示位姿(路线地图, 28, 22, 0.36, 0.91)
        }
        this.运行状态.goalPose = {
          position: [第一路点.x, 第一路点.y, 0],
          orientation: 由偏航角生成四元数(第一路点.yaw),
          yaw: 保留三位小数(第一路点.yaw),
          confidence: this.运行状态.currentPose?.confidence ?? 1,
        }
        this.运行状态.taskState = {
          state: 'running',
          task_type: 'patrol',
          task_id: 请求.taskName?.trim() || 请求.waypointFile.trim(),
          waypoint_file: 巡逻文件.path,
          waypoint_index: 0,
          waypoint_total: 巡逻文件.waypointCount,
          current_waypoint_name: 第一路点.name,
          current_waypoint_map: 巡逻文件.mapName,
          current_lap: 1,
        }
        break
      }
      case 'pause':
        if (!this.运行状态.taskState) {
          throw Http错误工厂.参数错误('当前没有活动中的任务', 'TASK_NOT_ACTIVE')
        }
        this.运行状态.taskState = {
          ...this.运行状态.taskState,
          state: 'paused',
        }
        break
      case 'resume':
        if (!this.运行状态.taskState) {
          throw Http错误工厂.参数错误('当前没有可恢复的任务', 'TASK_NOT_ACTIVE')
        }
        this.运行状态.taskState = {
          ...this.运行状态.taskState,
          state: 'running',
        }
        break
      case 'terminate':
        this.运行状态.taskState = null
        this.运行状态.goalPose = null
        break
      default:
        throw Http错误工厂.参数错误('不支持的巡逻命令', 'UNSUPPORTED_COMMAND')
    }

    this.记录运行时命令('patrol', 请求.command, 当前地图?.id ?? this.运行状态.activeMapId)
  }

  private 同步本地桩详情(地图列表: 地图元数据[]): void {
    const 当前地图 = this.获取当前地图(地图列表, this.运行状态.activeMapId)
    const 定位状态文本 = this.运行状态.localizationActive ? 'running' : 'idle'
    const 导航状态文本 = this.运行状态.goalPose
      ? (this.运行状态.taskState?.state === 'paused' ? 'paused' : 'running')
      : 'idle'
    const 巡逻导航目标 = this.运行状态.goalPose && this.运行状态.taskState?.task_type === 'patrol'
      ? {
          ...从位姿提取导航目标(
            this.运行状态.goalPose,
            读取字符串(this.运行状态.taskState, 'current_waypoint_map') ?? 当前地图?.name ?? null,
          ),
          name: 读取字符串(this.运行状态.taskState, 'current_waypoint_name') ?? null,
          waypoint_index: 读取数值(this.运行状态.taskState, 'waypoint_index') ?? 0,
          waypoint_total: 读取数值(this.运行状态.taskState, 'waypoint_total') ?? 0,
          lap: 读取数值(this.运行状态.taskState, 'current_lap') ?? 1,
        }
      : null
    const 导航目标 = 巡逻导航目标 ?? (this.运行状态.goalPose ? 从位姿提取导航目标(this.运行状态.goalPose, 当前地图?.name ?? null) : null)
    const 剩余距离 = this.运行状态.currentPose && this.运行状态.goalPose
      ? 计算平面距离(this.运行状态.currentPose, this.运行状态.goalPose)
      : null
    const 路径点 = this.运行状态.currentPose && this.运行状态.goalPose
      ? [
          {
            x: this.运行状态.currentPose.position[0],
            y: this.运行状态.currentPose.position[1],
          },
          {
            x: this.运行状态.goalPose.position[0],
            y: this.运行状态.goalPose.position[1],
          },
        ]
      : []
    const 雷达信息 = this.运行状态.lidarScan
      ? {
          connected: true,
          enabled: true,
          transport: 'stub',
          frame_id: this.运行状态.lidarScan.frameId,
          scan_ok: true,
        }
      : {
          connected: false,
          enabled: true,
          transport: 'stub',
          frame_id: 'laser',
          scan_ok: false,
        }

    this.运行状态.mapState = {
      state: this.运行状态.mappingActive
        ? 'mapping'
        : this.运行状态.localizationActive
          ? 'localized'
          : this.运行状态.activeMapId
            ? 'loaded'
            : 'idle',
      current_map: 当前地图?.name,
      last_map: 当前地图?.name ?? null,
      save_dir: this.地图目录,
      auto_save: true,
    }

    this.运行状态.navigationState = {
      state: 导航状态文本,
      current_goal: 导航目标,
      remaining_distance: 剩余距离,
      failure_reason: null,
      path_points: 路径点,
    }

    this.运行状态.sensorState = {
      lidar: 雷达信息,
    }

    this.运行状态.robotSummary = {
      health: {
        online: true,
        battery: 100,
        sdk_mode: true,
        control_mode: 'studio_stub',
        motion_mode: this.运行状态.mappingActive ? 'mapping' : 'navigation',
      },
      dog_bridge: {
        online: true,
        motion_control_enabled: true,
        sdk_ready: true,
        telemetry_online: true,
        motion_ready: true,
        emergency_stop: false,
        arbitration_reason: 'normal',
        command_age_sec: 0,
        telemetry_age_sec: 0,
        target_velocity: { vx: 0, vy: 0, wz: 0 },
        output_velocity: { vx: 0, vy: 0, wz: 0 },
      },
      lidar: 雷达信息,
      mapping: this.运行状态.mapState,
      localization: {
        state: 定位状态文本,
        map_name: 当前地图?.name,
        confidence: this.运行状态.currentPose?.confidence ?? null,
      },
      navigation: this.运行状态.navigationState,
      task: this.运行状态.taskState ?? undefined,
    }
  }

  private 记录命令(command: 地图命令类型, mapId: string | null): void {
    this.记录运行时命令('map', command, mapId)
  }

  private 记录运行时命令(channel: 运行时命令通道, command: 运行时命令类型, mapId: string | null): void {
    const timestamp = new Date().toISOString()
    const record: 地图命令记录 = {
      channel,
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
      commandHistory: 深复制数据(this.运行状态.commandHistory),
      currentPose: 深复制数据(this.运行状态.currentPose),
      goalPose: 深复制数据(this.运行状态.goalPose),
      lidarScan: 深复制数据(this.运行状态.lidarScan),
      telemetrySource: 'stub',
      commandSource: 'stub',
      selectedRobot: null,
      robotSummary: 深复制数据(this.运行状态.robotSummary),
      navigationState: 深复制数据(this.运行状态.navigationState),
      mapState: 深复制数据(this.运行状态.mapState),
      taskState: 深复制数据(this.运行状态.taskState),
      sensorState: 深复制数据(this.运行状态.sensorState),
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
        lidarScan: null,
        selectedRobot: 机器人信息,
      }
    }

    try {
      const telemetry = await 拉取机器人完整遥测(serverUrl)
      const 机器人摘要 = 读取对象(telemetry.robot_summary)
      const 定位状态 = 读取对象(机器人摘要?.localization)
      const 原始导航状态 = 读取对象(telemetry.navigation_state)
      const 当前位姿 = 解析平面位姿(原始导航状态?.current_pose, 读取数值(定位状态, 'confidence') ?? 1)
      const 目标位姿 = 解析平面位姿(原始导航状态?.current_goal, 读取数值(定位状态, 'confidence') ?? 1)
      const 导航摘要 = 读取对象(机器人摘要?.navigation)
      const 导航状态 = 归一化导航状态(原始导航状态, 导航摘要, 当前位姿, 目标位姿)
      const 地图状态 = 读取对象(telemetry.map_state) ?? 读取对象(机器人摘要?.mapping)
      const 原始任务状态 = 读取对象(telemetry.task_state)
      const 任务摘要 = 读取对象(机器人摘要?.task)
      const 任务状态 = 归一化任务状态(原始任务状态, 任务摘要, 导航状态)
      const 传感器状态 = 读取对象(telemetry.sensor_state) ?? 构建默认传感器状态(读取对象(机器人摘要?.lidar))
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
        lidarScan: null,
        telemetrySource: 'robot',
        commandSource: wsConnected ? 'robot_ws' : 'pending_robot',
        selectedRobot: 机器人信息,
        robotSummary: 深复制数据(机器人摘要 as 机器人摘要信息 | null),
        navigationState: 深复制数据(导航状态 as 运行时导航信息 | null),
        mapState: 深复制数据(地图状态 as 运行时地图信息 | null),
        taskState: 深复制数据(任务状态 as 运行时任务信息 | null),
        sensorState: 深复制数据(传感器状态 as 传感器状态信息 | null),
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
        lidarScan: null,
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
    const 归一化导航 = 归一化导航状态(
      读取对象(缓存.navigationState),
      导航状态摘要,
      解析平面位姿(读取对象(缓存.navigationState)?.current_pose, 读取数值(定位状态, 'confidence') ?? 1) ?? (缓存.lidarScan?.pose ? { ...缓存.lidarScan.pose } : null),
      解析平面位姿(读取对象(缓存.navigationState)?.current_goal, 读取数值(定位状态, 'confidence') ?? 1),
    )
    const 归一化任务 = 归一化任务状态(读取对象(缓存.taskState), 读取对象(缓存.robotSummary?.task), 归一化导航)
    const navigationState = 读取字符串(归一化导航, 'state')
    const mapState = 读取字符串(地图状态, 'state')
    const confidence = 读取数值(定位状态, 'confidence') ?? 1
    const 当前位姿 = 解析平面位姿(读取对象(缓存.navigationState)?.current_pose, confidence) ?? (缓存.lidarScan?.pose ? { ...缓存.lidarScan.pose } : null)
    const 目标位姿 = 解析平面位姿(读取对象(缓存.navigationState)?.current_goal, confidence)

    机器人信息.telemetryOnline = true
    机器人信息.telemetryFetchedAt = 缓存.lastUpdatedAt
    机器人信息.telemetryAvailableTypes = 可用类型列表(缓存)

    return {
      mode: 推断工作模式(mapState, localizationState, navigationState, 当前地图 ? 当前地图.id : null),
      activeMapId: 当前地图?.id ?? null,
      mappingActive: 是否为建图态(mapState),
      localizationActive: 是否为定位态(localizationState),
      currentPose: 当前位姿,
      goalPose: 目标位姿,
      lidarScan: 缓存.lidarScan ? 复制激光扫描(缓存.lidarScan) : null,
      telemetrySource: 'robot',
      commandSource: 'robot_ws',
      selectedRobot: 机器人信息,
      robotSummary: 深复制数据(缓存.robotSummary),
      navigationState: 深复制数据(归一化导航),
      mapState: 深复制数据(缓存.mapState),
      taskState: 深复制数据(归一化任务),
      sensorState: 深复制数据(缓存.sensorState),
    }
  }

  private async 执行机器人命令(robotId: string, 请求: 工作台命令请求): Promise<地图运行状态> {
    const 机器人 = await this.机器人仓库.getRobot(robotId)
    if (!机器人) {
      throw Http错误工厂.未找到('未找到指定机器人', 'ROBOT_NOT_FOUND')
    }

    if (!this.是否机器人在线(robotId)) {
      throw Http错误工厂.参数错误('机器人尚未连接到工作站业务通道', 'ROBOT_WS_OFFLINE')
    }

    const 地图列表 = await this.获取地图列表()
    const 目标地图 = this.解析请求目标地图(请求, 地图列表)
    const requestId = uuidv7()
    const payload = 构建运行时命令负载(requestId, 请求, 目标地图)
    const messageType = 构建运行时消息类型(请求.type)

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
      type: messageType,
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

  private 处理命令响应(data: Record<string, unknown>): void {
    const requestId = typeof data.requestId === 'string' ? data.requestId : ''
    if (!requestId) {
      return
    }

    const pending = this.待完成命令.get(requestId)
    if (!pending) {
      return
    }

    this.待完成命令.delete(requestId)
    clearTimeout(pending.timeout)
    pending.resolve(data)
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
    taskState: null,
    sensorState: null,
    lastMapResponse: null,
    lastNavigationResponse: null,
    lastPatrolResponse: null,
    lidarScan: null,
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
  if (缓存.taskState) {
    types.push('task_state')
  }
  if (缓存.sensorState) {
    types.push('sensor_state')
  }
  if (缓存.lastMapResponse) {
    types.push('map_response')
  }
  if (缓存.lastNavigationResponse) {
    types.push('navigation_response')
  }
  if (缓存.lastPatrolResponse) {
    types.push('patrol_response')
  }
  if (缓存.lidarScan) {
    types.push('lidar_scan')
  }
  return types
}

function 复制激光扫描(scan: 激光扫描数据): 激光扫描数据 {
  return {
    ...scan,
    ranges: [...scan.ranges],
    pose: scan.pose ? { ...scan.pose } : null,
  }
}

function 解析激光扫描(value: Record<string, unknown>): 激光扫描数据 | null {
  if (读取布尔值(value, 'available') !== true) {
    return null
  }

  const angleMin = 读取数值(value, 'angle_min')
  const angleMax = 读取数值(value, 'angle_max')
  const angleIncrement = 读取数值(value, 'angle_increment')
  const rangeMin = 读取数值(value, 'range_min')
  const rangeMax = 读取数值(value, 'range_max')
  const capturedAt = 读取数值(value, 'captured_at')
  if (angleMin === null || angleMax === null || angleIncrement === null || rangeMin === null || rangeMax === null || capturedAt === null) {
    return null
  }

  const ranges = 读取可空数值数组(value.ranges)
  const poseObject = 读取对象(value.pose)
  const pose = poseObject ? 解析平面位姿(poseObject, 读取数值(poseObject, 'confidence') ?? 1) : null
  const pointCount = 读取数值(value, 'point_count')

  return {
    frameId: 读取字符串(value, 'frame_id') ?? 'laser',
    angleMin,
    angleMax,
    angleIncrement,
    rangeMin,
    rangeMax,
    scanTime: 读取数值(value, 'scan_time'),
    timeIncrement: 读取数值(value, 'time_increment'),
    ranges,
    pointCount: pointCount ?? ranges.filter((item) => item !== null).length,
    capturedAt: Math.trunc(capturedAt),
    pose,
  }
}

async function 打开系统目录(targetPath: string): Promise<void> {
  const command =
    process.platform === 'win32'
      ? 'explorer.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open'

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [targetPath], {
      detached: true,
      stdio: 'ignore',
    })

    child.once('error', (error) => {
      reject(new Error(`打开地图目录失败: ${error.message}`))
    })

    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function 构建运行时消息类型(type: 工作台命令请求['type']): 'map_command' | 'navigation_command' | 'patrol_command' {
  switch (type) {
    case 'map':
      return 'map_command'
    case 'navigation':
      return 'navigation_command'
    case 'patrol':
      return 'patrol_command'
    default:
      return 'map_command'
  }
}

function 构建运行时命令负载(
  requestId: string,
  请求: 工作台命令请求,
  map: 地图元数据 | null,
): Record<string, unknown> {
  switch (请求.type) {
    case 'map':
      return 构建地图命令负载(requestId, 请求.command, map, 请求.mapName)
    case 'navigation':
      return 构建导航命令负载(requestId, 请求)
    case 'patrol':
      return 构建巡逻命令负载(requestId, 请求)
    default:
      return {
        requestId,
      }
  }
}

function 构建地图命令负载(
  requestId: string,
  command: 地图命令类型,
  map: 地图元数据 | null,
  mapName?: string,
): Record<string, unknown> {
  const 目标地图名 = typeof mapName === 'string' && mapName.trim().length > 0 ? mapName.trim() : map?.name

  switch (command) {
    case 'start_mapping':
      return {
        requestId,
        command: 'start_mapping',
        map_name: 目标地图名,
      }
    case 'stop_mapping':
      return {
        requestId,
        command: 'stop_mapping',
        save_map: true,
      }
    case 'load_map':
      return {
        requestId,
        command: 'load_map',
        map_name: 目标地图名,
      }
    case 'start_localization':
      return {
        requestId,
        command: 'start_localization',
        map_name: 目标地图名,
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

function 构建导航命令负载(
  requestId: string,
  请求: Extract<工作台命令请求, { type: 'navigation' }>,
): Record<string, unknown> {
  if (请求.command === 'navigate_to') {
    if (!请求.goal) {
      return {
        requestId,
        command: 'navigate_to',
      }
    }

    return {
      requestId,
      command: 'navigate_to',
      goal: {
        x: 请求.goal.x,
        y: 请求.goal.y,
        yaw: 请求.goal.yaw,
        frame_id: 请求.goal.frameId,
        map_name: 请求.goal.mapName ?? undefined,
      },
    }
  }

  return {
    requestId,
    command: 请求.command,
  }
}

function 构建巡逻命令负载(
  requestId: string,
  请求: Extract<工作台命令请求, { type: 'patrol' }>,
): Record<string, unknown> {
  if (请求.command === 'start_patrol') {
    return {
      requestId,
      command: 'start',
      task_name: 请求.taskName,
      waypoint_file: 请求.waypointFile,
    }
  }

  return {
    requestId,
    command: 请求.command,
  }
}

function 规范化机器人服务地址(机器人: RobotRecord): string | null {
  if (机器人.serverUrl && 机器人.serverUrl.trim().length > 0) {
    return 机器人.serverUrl.trim()
  }
  if (机器人.ip && 机器人.ip.trim().length > 0) {
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

function 由导航目标创建位姿(goal: 导航目标): 平面位姿 {
  return {
    position: [保留三位小数(goal.x), 保留三位小数(goal.y), 0],
    orientation: 由偏航角生成四元数(goal.yaw),
    yaw: 保留三位小数(goal.yaw),
    confidence: 1,
  }
}

function 从位姿提取导航目标(pose: 平面位姿, mapName: string | null): Record<string, unknown> {
  return {
    x: 保留三位小数(pose.position[0]),
    y: 保留三位小数(pose.position[1]),
    yaw: pose.yaw,
    frame_id: 'map',
    map_name: mapName,
  }
}

function 归一化导航状态(
  原始导航状态: Record<string, unknown> | null,
  导航摘要: Record<string, unknown> | null,
  当前位姿: 平面位姿 | null,
  目标位姿: 平面位姿 | null,
): 运行时导航信息 | null {
  if (!原始导航状态 && !导航摘要) {
    return null
  }

  const 当前目标 = 归一化导航目标(
    读取对象(原始导航状态?.current_goal) ?? 读取对象(导航摘要?.current_goal),
    目标位姿,
  )
  const 路径点 = 提取路径点(原始导航状态, 当前位姿, 目标位姿)

  return {
    ...(导航摘要 ?? {}),
    ...(原始导航状态 ?? {}),
    state: 读取首个字符串([
      原始导航状态 ? 读取字符串(原始导航状态, 'state') : null,
      导航摘要 ? 读取字符串(导航摘要, 'state') : null,
    ]) ?? undefined,
    current_goal: 当前目标,
    remaining_distance: 读取首个数值([
      原始导航状态 ? 读取数值(原始导航状态, 'remaining_distance') : null,
      原始导航状态 ? 读取数值(原始导航状态, 'remaining_distance_to_current') : null,
      导航摘要 ? 读取数值(导航摘要, 'remaining_distance') : null,
    ]),
    failure_reason: 读取首个字符串([
      原始导航状态 ? 读取字符串(原始导航状态, 'failure_reason') : null,
      原始导航状态 ? 读取字符串(原始导航状态, 'error') : null,
      原始导航状态 ? 读取字符串(原始导航状态, 'status_message') : null,
      导航摘要 ? 读取字符串(导航摘要, 'failure_reason') : null,
    ]),
    path_points: 路径点,
  }
}

function 归一化导航目标(value: Record<string, unknown> | null, 目标位姿: 平面位姿 | null): Record<string, unknown> | null {
  if (!value && !目标位姿) {
    return null
  }

  const 已归一化位置 = value ? 解析导航点(value) : null
  const frameId = 读取首个字符串([
    value ? 读取字符串(value, 'frame_id') : null,
    value ? 读取字符串(value, 'frameId') : null,
  ]) ?? 'map'
  const mapName = 读取首个字符串([
    value ? 读取字符串(value, 'map_name') : null,
    value ? 读取字符串(value, 'mapName') : null,
  ])

  return {
    ...(value ?? {}),
    x: 已归一化位置?.x ?? (目标位姿 ? 保留三位小数(目标位姿.position[0]) : null),
    y: 已归一化位置?.y ?? (目标位姿 ? 保留三位小数(目标位姿.position[1]) : null),
    yaw: 已归一化位置?.yaw ?? (目标位姿 ? 目标位姿.yaw : null),
    frame_id: frameId,
    map_name: mapName,
  }
}

function 提取路径点(
  导航状态: Record<string, unknown> | null,
  当前位姿: 平面位姿 | null,
  目标位姿: 平面位姿 | null,
): Array<{ x: number; y: number }> {
  const 现成路径 = 解析路径点列表(
    导航状态?.path_points
    ?? 导航状态?.planned_path
    ?? 导航状态?.path
    ?? 导航状态?.trajectory,
  )
  if (现成路径.length > 0) {
    return 现成路径
  }

  if (!当前位姿 || !目标位姿) {
    return []
  }

  return [
    {
      x: 保留三位小数(当前位姿.position[0]),
      y: 保留三位小数(当前位姿.position[1]),
    },
    {
      x: 保留三位小数(目标位姿.position[0]),
      y: 保留三位小数(目标位姿.position[1]),
    },
  ]
}

function 解析路径点列表(value: unknown): Array<{ x: number; y: number }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => 解析导航点(item))
      .filter((item): item is { x: number; y: number; yaw?: number } => item !== null)
      .map((item) => ({ x: item.x, y: item.y }))
  }

  if (是对象(value)) {
    return 解析路径点列表(value.points ?? value.path ?? value.poses ?? value.waypoints)
  }

  return []
}

function 解析导航点(value: unknown): { x: number; y: number; yaw?: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0])
    const y = Number(value[1])
    const yaw = value.length >= 3 ? Number(value[2]) : undefined
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }
    return {
      x: 保留三位小数(x),
      y: 保留三位小数(y),
      yaw: yaw !== undefined && Number.isFinite(yaw) ? 保留三位小数(yaw) : undefined,
    }
  }

  const point = 读取对象(value)
  if (!point) {
    return null
  }

  const x = 读取首个数值([
    读取数值(point, 'x'),
    读取对象(point.position) ? 读取数值(读取对象(point.position), 'x') : null,
  ])
  const y = 读取首个数值([
    读取数值(point, 'y'),
    读取对象(point.position) ? 读取数值(读取对象(point.position), 'y') : null,
  ])
  const yaw = 读取首个数值([
    读取数值(point, 'yaw'),
    point.orientation ? 从姿态对象解析偏航角(point.orientation) : null,
  ])

  if (x === null || y === null) {
    const positionArray = 读取三元数值数组(point.position)
    if (!positionArray) {
      return null
    }
    return {
      x: 保留三位小数(positionArray[0]),
      y: 保留三位小数(positionArray[1]),
      yaw: yaw ?? undefined,
    }
  }

  return {
    x: 保留三位小数(x),
    y: 保留三位小数(y),
    yaw: yaw ?? undefined,
  }
}

function 归一化任务状态(
  原始任务状态: Record<string, unknown> | null,
  任务摘要: Record<string, unknown> | null,
  导航状态: 运行时导航信息 | null,
): 运行时任务信息 | null {
  if (!原始任务状态 && !任务摘要) {
    return null
  }

  const 当前目标 = 读取对象(导航状态?.current_goal)

  return {
    ...(任务摘要 ?? {}),
    ...(原始任务状态 ?? {}),
    state: 读取首个字符串([
      原始任务状态 ? 读取字符串(原始任务状态, 'state') : null,
      任务摘要 ? 读取字符串(任务摘要, 'state') : null,
    ]) ?? undefined,
    task_type: 读取首个字符串([
      原始任务状态 ? 读取字符串(原始任务状态, 'task_type') : null,
      任务摘要 ? 读取字符串(任务摘要, 'task_type') : null,
    ]),
    task_id: 读取首个字符串([
      原始任务状态 ? 读取字符串(原始任务状态, 'task_id') : null,
      任务摘要 ? 读取字符串(任务摘要, 'task_id') : null,
    ]),
    waypoint_index: 读取首个数值([
      原始任务状态 ? 读取数值(原始任务状态, 'waypoint_index') : null,
      当前目标 ? 读取数值(当前目标, 'waypoint_index') : null,
    ]),
    waypoint_total: 读取首个数值([
      原始任务状态 ? 读取数值(原始任务状态, 'waypoint_total') : null,
      当前目标 ? 读取数值(当前目标, 'waypoint_total') : null,
    ]),
    current_waypoint_name: 读取首个字符串([
      原始任务状态 ? 读取字符串(原始任务状态, 'current_waypoint_name') : null,
      当前目标 ? 读取字符串(当前目标, 'name') : null,
    ]),
    current_lap: 读取首个数值([
      原始任务状态 ? 读取数值(原始任务状态, 'current_lap') : null,
      当前目标 ? 读取数值(当前目标, 'lap') : null,
    ]),
  }
}

function 构建默认传感器状态(lidar: Record<string, unknown> | null): 传感器状态信息 | null {
  if (!lidar) {
    return null
  }
  return {
    lidar: lidar as Record<string, unknown>,
  }
}

function 计算平面距离(source: 平面位姿, target: 平面位姿): number {
  const dx = target.position[0] - source.position[0]
  const dy = target.position[1] - source.position[1]
  return 保留两位小数(Math.sqrt(dx * dx + dy * dy))
}

function 深复制数据<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }
  return globalThis.structuredClone(value)
}

function requestIsBlank(value: string): boolean {
  return value.trim().length === 0
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

function 读取首个字符串(candidates: Array<string | null>): string | null {
  return candidates.find((item) => typeof item === 'string' && item.trim().length > 0) ?? null
}

function 读取首个数值(candidates: Array<number | null>): number | null {
  return candidates.find((item) => typeof item === 'number' && Number.isFinite(item)) ?? null
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

function 从姿态对象解析偏航角(value: unknown): number | null {
  const 四元数数组 = 读取四元数值数组(value)
  if (四元数数组) {
    return 从四元数解析偏航角(四元数数组)
  }

  const 姿态对象 = 读取对象(value)
  if (!姿态对象) {
    return null
  }

  const x = 读取数值(姿态对象, 'x')
  const y = 读取数值(姿态对象, 'y')
  const z = 读取数值(姿态对象, 'z')
  const w = 读取数值(姿态对象, 'w')
  if (x === null || y === null || z === null || w === null) {
    return null
  }
  return 从四元数解析偏航角([x, y, z, w])
}

function 读取字符串数组(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function 读取可空数值数组(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => {
    if (item === null) {
      return null
    }
    const numberValue = typeof item === 'number' ? item : Number(item)
    return Number.isFinite(numberValue) ? numberValue : null
  })
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

async function 递归收集巡逻Json(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await 递归收集巡逻Json(fullPath))
      continue
    }

    if (entry.isFile() && /\.json$/i.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function 解析巡逻文件内容(
  text: string,
  默认名称: string,
): {
  name: string
  mapName: string | null
  loop: boolean
  arrivalWaitSec: number | null
  waypoints: 巡逻点详情[]
} {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw Http错误工厂.参数错误(
      `巡逻文件不是有效 JSON: ${提取错误消息(error)}`,
      'WAYPOINT_FILE_INVALID',
    )
  }

  const 根对象 = 是记录对象(parsed) ? parsed : null
  const 原始路点列表 = Array.isArray(parsed)
    ? parsed
    : Array.isArray(根对象?.waypoints)
      ? 根对象.waypoints
      : null

  if (!原始路点列表) {
    throw Http错误工厂.参数错误('巡逻文件缺少 waypoints 数组', 'WAYPOINT_FILE_INVALID')
  }

  const waypoints = 原始路点列表.map((item, index) => 解析巡逻点(item, index))

  return {
    name: 读取可选字符串(根对象?.name)?.trim() || 默认名称,
    mapName: 读取可选字符串(根对象?.map_name ?? 根对象?.mapName),
    loop: 读取可选布尔(根对象?.loop) ?? false,
    arrivalWaitSec: 读取可选数字(根对象?.arrival_wait_sec ?? 根对象?.arrivalWaitSec),
    waypoints,
  }
}

function 解析巡逻点(item: unknown, index: number): 巡逻点详情 {
  if (!是记录对象(item)) {
    throw Http错误工厂.参数错误(`巡逻文件第 ${index + 1} 个路点格式无效`, 'WAYPOINT_FILE_INVALID')
  }

  return {
    index,
    name: 读取可选字符串(item.name)?.trim() || `waypoint-${index + 1}`,
    x: 读取必填数字(item.x, `第 ${index + 1} 个路点的 x`),
    y: 读取必填数字(item.y, `第 ${index + 1} 个路点的 y`),
    yaw: 读取必填数字(item.yaw, `第 ${index + 1} 个路点的 yaw`),
    frameId: 读取可选字符串(item.frame_id ?? item.frameId),
    arrivalWaitSec: 读取可选数字(item.arrival_wait_sec ?? item.arrivalWaitSec),
  }
}

function 是记录对象(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function 读取可选字符串(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function 读取可选数字(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function 读取必填数字(value: unknown, 字段名: string): number {
  const 数值 = 读取可选数字(value)
  if (数值 === null) {
    throw Http错误工厂.参数错误(`${字段名} 不是有效数字`, 'WAYPOINT_FILE_INVALID')
  }
  return 数值
}

function 读取可选布尔(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }

  return null
}

function 提取错误消息(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

function 生成巡逻文件Id(relativeJsonPath: string): string {
  return relativeJsonPath
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
