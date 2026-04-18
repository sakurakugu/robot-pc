export type RobotStatus = 'online' | 'offline' | 'connecting' | 'error'

export interface Robot {
  uuid: string
  name?: string | null
  ip?: string | null
  status: RobotStatus
  serverUrl?: string | null
}

export interface SaveRobotPayload {
  uuid: string
  name: string
  ip: string
  serverUrl?: string | null
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
