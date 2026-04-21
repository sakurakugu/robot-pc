export type RobotStatus = 'online' | 'offline' | 'connecting' | 'error'

export interface Robot {
  uuid: string
  name?: string | null
  model?: string | null
  ip?: string | null
  group_name?: string | null
  tags: string[]
  sn?: string | null
  status: RobotStatus
  serverUrl?: string | null
}

export interface SaveRobotPayload {
  uuid: string
  name?: string | null
  model?: string | null
  ip?: string | null
  group_name?: string | null
  tags?: string[]
  sn?: string | null
  serverUrl?: string | null
}

export interface DiscoveredRobot {
  uuid: string
  name: string
  model: string
  version: string
  ip: string
  port: number
}

export interface CloudRobotRecord {
  uuid: string
  name?: string | null
  model?: string | null
  version?: string | null
  ip?: string | null
  robot_ip?: string | null
  local_ip?: string | null
  local_port?: number | null
  group_name?: string | null
  tags?: string[] | string | null
  sn?: string | null
  metadata?: Record<string, unknown> | string | null
  status: RobotStatus
}

export interface StudioAccessCandidate {
  label: string
  host: string
  businessUrlTemplate: string
}

export interface RobotAccessInfoResponse {
  success: boolean
  data: {
    port: number
    businessPath: string
    candidates: StudioAccessCandidate[]
  }
}

export interface RobotListResponse {
  success: boolean
  data: {
    robots: Robot[]
  }
}

export interface RobotDiscoveryResponse {
  success: boolean
  data: {
    robots: DiscoveredRobot[]
  }
}

export interface CloudRobotListResponse {
  success: boolean
  data: {
    robots: CloudRobotRecord[]
  }
}

export type RobotProbeStatus = 'ok' | 'timeout' | 'refused' | 'error' | 'invalid' | 'missing'

export interface RobotDiagnosticProbe {
  status: RobotProbeStatus
  message: string
  url: string | null
  httpStatus: number | null
  durationMs: number | null
  checkedAt: string
}

export interface RobotDiagnosticWsChannel {
  status: 'connected' | 'disconnected'
  connected: boolean
  message: string
  checkedAt: string
}

export interface RobotConnectionDiagnosis {
  robot: Robot
  checkedAt: string
  server: RobotDiagnosticProbe
  runtime: RobotDiagnosticProbe
  telemetry: RobotDiagnosticProbe
  workstationWebsocket: RobotDiagnosticWsChannel
}

export interface RobotDiagnosisResponse {
  success: boolean
  data: {
    diagnosis: RobotConnectionDiagnosis
  }
}
