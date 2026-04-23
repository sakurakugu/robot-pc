export type 地图工作模式 = 'idle' | 'mapping' | 'map_loaded' | 'localizing'
export type 地图遥测来源 = 'stub' | 'robot'
export type 地图命令来源 = 'stub' | 'robot_ws' | 'pending_robot'
export type 运行时命令通道 = 'map' | 'navigation' | 'patrol'

export type 地图命令类型 =
  | 'start_mapping'
  | 'stop_mapping'
  | 'load_map'
  | 'start_localization'
  | 'stop_localization'

export type 导航命令类型 =
  | 'navigate_to'
  | 'cancel'
  | 'pause'
  | 'resume'
  | 'terminate'

export type 巡逻命令类型 =
  | 'start_patrol'
  | 'pause'
  | 'resume'
  | 'terminate'

export type 运行时命令类型 = 地图命令类型 | 导航命令类型 | 巡逻命令类型

export interface 地图元数据 {
  id: string
  name: string
  yamlPath: string
  imagePath: string
  imageUrl: string
  imageFormat: string
  resolution: number
  origin: [number, number, number]
  negate: number
  occupiedThresh: number
  freeThresh: number
  updatedAt: string
}

export interface 远程地图元数据 {
  id: string
  name: string
  yamlPath: string
  imagePath: string
  imageFormat: string
  updatedAt: string
}

export interface 远程地图列表 {
  robotId: string
  serverUrl: string
  mapDirectory: string
  maps: 远程地图元数据[]
}

export interface 地图下载结果 {
  robotId: string
  mapId: string
  importedMapCount: number
  importedMaps: 地图元数据[]
}

export interface 巡逻文件元数据 {
  id: string
  name: string
  path: string
  updatedAt: string
}

export interface 巡逻点详情 {
  index: number
  name: string
  x: number
  y: number
  yaw: number
  frameId: string | null
  arrivalWaitSec: number | null
}

export interface 巡逻文件详情 extends 巡逻文件元数据 {
  mapName: string | null
  loop: boolean
  arrivalWaitSec: number | null
  waypointCount: number
  waypoints: 巡逻点详情[]
}

export interface 平面位姿 {
  position: [number, number, number]
  orientation: [number, number, number, number]
  yaw: number
  confidence: number
}

export interface 导航目标 {
  x: number
  y: number
  yaw: number
  frameId: string
  mapName: string | null
}

export interface 激光扫描数据 {
  frameId: string
  angleMin: number
  angleMax: number
  angleIncrement: number
  rangeMin: number
  rangeMax: number
  scanTime: number | null
  timeIncrement: number | null
  ranges: Array<number | null>
  pointCount: number
  capturedAt: number
  pose: 平面位姿 | null
}

export interface 地图命令记录 {
  channel: 运行时命令通道
  command: 运行时命令类型
  mapId: string | null
  timestamp: string
  status: 'accepted'
}

export interface 运行时健康信息 extends Record<string, unknown> {
  online?: boolean
  battery?: number | string | null
  sdk_mode?: boolean
  control_mode?: string
  motion_mode?: string
}

export interface 运行时雷达信息 extends Record<string, unknown> {
  enabled?: boolean
  connected?: boolean
  transport?: string
  frame_id?: string
  scan_ok?: boolean
}

export interface 运行时地图信息 extends Record<string, unknown> {
  state?: string
  current_map?: string
  last_map?: string | null
  save_dir?: string
  auto_save?: boolean
}

export interface 运行时定位信息 extends Record<string, unknown> {
  state?: string
  map_name?: string
  confidence?: number | string | null
}

export interface 运行时导航信息 extends Record<string, unknown> {
  state?: string
  current_goal?: Record<string, unknown> | null
  remaining_distance?: number | string | null
  failure_reason?: string | null
}

export interface 运行时速度信息 extends Record<string, unknown> {
  vx?: number | string | null
  vy?: number | string | null
  wz?: number | string | null
}

export interface 运控桥信息 extends Record<string, unknown> {
  online?: boolean
  motion_control_enabled?: boolean
  sdk_ready?: boolean
  telemetry_online?: boolean
  motion_ready?: boolean
  emergency_stop?: boolean
  arbitration_reason?: string
  command_age_sec?: number | string | null
  telemetry_age_sec?: number | string | null
  target_velocity?: 运行时速度信息
  output_velocity?: 运行时速度信息
}

export interface 运行时任务信息 extends Record<string, unknown> {
  state?: string
  task_type?: string | null
  task_id?: string | null
}

export interface 机器人摘要信息 extends Record<string, unknown> {
  health?: 运行时健康信息
  dog_bridge?: 运控桥信息
  lidar?: 运行时雷达信息
  mapping?: 运行时地图信息
  localization?: 运行时定位信息
  navigation?: 运行时导航信息
  task?: 运行时任务信息
}

export interface 传感器状态信息 extends Record<string, unknown> {
  lidar?: 运行时雷达信息
}

export interface 选中机器人运行信息 {
  uuid: string
  name: string | null
  ip: string | null
  status: 'online' | 'offline' | 'connecting' | 'error'
  serverUrl: string | null
  wsConnected: boolean
  telemetryOnline: boolean | null
  telemetryFetchedAt: string | null
  telemetryAvailableTypes: string[]
  telemetryError: string | null
}

export interface 地图运行状态 {
  mode: 地图工作模式
  activeMapId: string | null
  mappingActive: boolean
  localizationActive: boolean
  currentPose: 平面位姿 | null
  goalPose: 平面位姿 | null
  lidarScan: 激光扫描数据 | null
  lastCommand: 运行时命令类型 | null
  lastCommandAt: string | null
  commandHistory: 地图命令记录[]
  availableMapCount: number
  mapDirectory: string
  telemetrySource: 地图遥测来源
  commandSource: 地图命令来源
  selectedRobot: 选中机器人运行信息 | null
  robotSummary: 机器人摘要信息 | null
  navigationState: 运行时导航信息 | null
  mapState: 运行时地图信息 | null
  taskState: 运行时任务信息 | null
  sensorState: 传感器状态信息 | null
}

export interface 地图控制请求 {
  type: 'map'
  command: 地图命令类型
  mapId?: string
  mapName?: string
}

export interface 导航控制请求 {
  type: 'navigation'
  command: 导航命令类型
  goal?: 导航目标
}

export interface 巡逻控制请求 {
  type: 'patrol'
  command: 巡逻命令类型
  taskName?: string
  waypointFile?: string
}

export type 工作台命令请求 = 地图控制请求 | 导航控制请求 | 巡逻控制请求
export type 地图命令请求 = 工作台命令请求
