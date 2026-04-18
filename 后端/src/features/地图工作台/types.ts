export type 地图工作模式 = 'idle' | 'mapping' | 'map_loaded' | 'localizing'

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

export interface 地图命令记录 {
  command: 地图命令类型
  mapId: string | null
  timestamp: string
  status: 'accepted'
}

export interface 地图运行状态 {
  mode: 地图工作模式
  activeMapId: string | null
  mappingActive: boolean
  localizationActive: boolean
  currentPose: 平面位姿 | null
  goalPose: 平面位姿 | null
  lastCommand: 地图命令类型 | null
  lastCommandAt: string | null
  commandHistory: 地图命令记录[]
  availableMapCount: number
  mapDirectory: string
}

export interface 地图命令请求 {
  command: 地图命令类型
  mapId?: string
}
