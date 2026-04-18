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
