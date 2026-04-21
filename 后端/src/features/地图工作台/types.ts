export type 地图工作模式 = 'idle' | 'mapping' | 'map_loaded' | 'localizing'
export type 地图遥测来源 = 'stub' | 'robot'
export type 地图命令来源 = 'stub' | 'robot_ws' | 'pending_robot'

export type 地图命令类型 =
  | 'start_mapping'
  | 'load_map'
  | 'start_localization'
  | 'stop_localization'

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

export interface 平面位姿 {
  position: [number, number, number]
  orientation: [number, number, number, number]
  yaw: number
  confidence: number
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
  command: 地图命令类型
  mapId: string | null
  timestamp: string
  status: 'accepted'
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
  lastCommand: 地图命令类型 | null
  lastCommandAt: string | null
  commandHistory: 地图命令记录[]
  availableMapCount: number
  mapDirectory: string
  telemetrySource: 地图遥测来源
  commandSource: 地图命令来源
  selectedRobot: 选中机器人运行信息 | null
}

export interface 地图命令请求 {
  command: 地图命令类型
  mapId?: string
}
