export type MappingMode = 'idle' | 'mapping' | 'map_loaded' | 'localizing'
export type MappingTelemetrySource = 'stub' | 'robot'
export type MappingCommandSource = 'stub' | 'robot_ws' | 'pending_robot'
export type RuntimeCommandChannel = 'map' | 'navigation' | 'patrol'

export type MappingCommand = 'start_mapping' | 'stop_mapping' | 'load_map' | 'start_localization' | 'stop_localization'
export type NavigationCommand = 'navigate_to' | 'cancel' | 'pause' | 'resume' | 'terminate'
export type PatrolCommand = 'start_patrol' | 'pause' | 'resume' | 'terminate'
export type RuntimeCommand = MappingCommand | NavigationCommand | PatrolCommand

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

export interface WaypointFile {
  id: string
  name: string
  path: string
  updatedAt: string
}

export interface WaypointDetailItem {
  index: number
  name: string
  x: number
  y: number
  yaw: number
  frameId: string | null
  arrivalWaitSec: number | null
}

export interface WaypointFileDetail extends WaypointFile {
  mapName: string | null
  loop: boolean
  arrivalWaitSec: number | null
  waypointCount: number
  waypoints: WaypointDetailItem[]
}

export interface PlanarPose {
  position: [number, number, number]
  orientation: [number, number, number, number]
  yaw: number
  confidence: number
}

export interface NavigationGoal {
  x: number
  y: number
  yaw: number
  frameId: string
  mapName: string | null
}

export interface LidarScan {
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
  pose: PlanarPose | null
}

export interface MappingCommandRecord {
  channel: RuntimeCommandChannel
  command: RuntimeCommand
  mapId: string | null
  timestamp: string
  status: 'accepted'
}

export interface RuntimeHealthData extends Record<string, unknown> {
  online?: boolean
  battery?: number | string | null
  sdk_mode?: boolean
  control_mode?: string
  motion_mode?: string
}

export interface RuntimeLidarData extends Record<string, unknown> {
  enabled?: boolean
  connected?: boolean
  transport?: string
  frame_id?: string
  scan_ok?: boolean
}

export interface RuntimeMapData extends Record<string, unknown> {
  state?: string
  current_map?: string
  last_map?: string | null
  save_dir?: string
  auto_save?: boolean
}

export interface RuntimeLocalizationData extends Record<string, unknown> {
  state?: string
  map_name?: string
  confidence?: number | string | null
}

export interface RuntimeNavigationData extends Record<string, unknown> {
  state?: string
  current_goal?: Record<string, unknown> | null
  remaining_distance?: number | string | null
  failure_reason?: string | null
}

export interface RuntimeDogBridgeVelocityData extends Record<string, unknown> {
  vx?: number | string | null
  vy?: number | string | null
  wz?: number | string | null
}

export interface RuntimeDogBridgeData extends Record<string, unknown> {
  online?: boolean
  motion_control_enabled?: boolean
  sdk_ready?: boolean
  telemetry_online?: boolean
  motion_ready?: boolean
  emergency_stop?: boolean
  arbitration_reason?: string
  command_age_sec?: number | string | null
  telemetry_age_sec?: number | string | null
  target_velocity?: RuntimeDogBridgeVelocityData
  output_velocity?: RuntimeDogBridgeVelocityData
}

export interface RuntimeTaskData extends Record<string, unknown> {
  state?: string
  task_type?: string | null
  task_id?: string | null
}

export interface RobotSummaryData extends Record<string, unknown> {
  health?: RuntimeHealthData
  dog_bridge?: RuntimeDogBridgeData
  lidar?: RuntimeLidarData
  mapping?: RuntimeMapData
  localization?: RuntimeLocalizationData
  navigation?: RuntimeNavigationData
  task?: RuntimeTaskData
}

export interface SensorStateData extends Record<string, unknown> {
  lidar?: RuntimeLidarData
}

export interface SelectedRobotRuntime {
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

export interface MappingRuntime {
  mode: MappingMode
  activeMapId: string | null
  mappingActive: boolean
  localizationActive: boolean
  currentPose: PlanarPose | null
  goalPose: PlanarPose | null
  lidarScan: LidarScan | null
  lastCommand: RuntimeCommand | null
  lastCommandAt: string | null
  commandHistory: MappingCommandRecord[]
  availableMapCount: number
  mapDirectory: string
  telemetrySource: MappingTelemetrySource
  commandSource: MappingCommandSource
  selectedRobot: SelectedRobotRuntime | null
  robotSummary: RobotSummaryData | null
  navigationState: RuntimeNavigationData | null
  mapState: RuntimeMapData | null
  taskState: RuntimeTaskData | null
  sensorState: SensorStateData | null
}

export interface MapCommandRequest {
  type: 'map'
  command: MappingCommand
  mapId?: string
  mapName?: string
}

export interface NavigationCommandRequest {
  type: 'navigation'
  command: NavigationCommand
  goal?: NavigationGoal
}

export interface PatrolCommandRequest {
  type: 'patrol'
  command: PatrolCommand
  taskName?: string
  waypointFile?: string
}

export type MappingRequest = MapCommandRequest | NavigationCommandRequest | PatrolCommandRequest
