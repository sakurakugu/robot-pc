export type MappingMode = 'idle' | 'mapping' | 'map_loaded' | 'localizing'
export type MappingTelemetrySource = 'stub' | 'robot'
export type MappingCommandSource = 'stub' | 'pending_robot'

export type MappingCommand = 'start_mapping' | 'load_map' | 'start_localization' | 'stop_localization'

export interface StudioMap {
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

export interface PlanarPose {
  position: [number, number, number]
  orientation: [number, number, number, number]
  yaw: number
  confidence: number
}

export interface MappingCommandRecord {
  command: MappingCommand
  mapId: string | null
  timestamp: string
  status: 'accepted'
}

export interface SelectedRobotRuntime {
  uuid: string
  name: string
  ip: string
  status: 'online' | 'offline' | 'connecting' | 'error'
  serverUrl: string | null
  telemetryOnline: boolean | null
  telemetryFetchedAt: string | null
  telemetryAvailableTypes: string[]
  telemetryError: string | null
}

export interface MappingRuntime {
  mode: MappingMode
  activeMapId: string | null
  mappingActive: boolean
  localizationActive: boolean
  currentPose: PlanarPose | null
  goalPose: PlanarPose | null
  lastCommand: MappingCommand | null
  lastCommandAt: string | null
  commandHistory: MappingCommandRecord[]
  availableMapCount: number
  mapDirectory: string
  telemetrySource: MappingTelemetrySource
  commandSource: MappingCommandSource
  selectedRobot: SelectedRobotRuntime | null
}
