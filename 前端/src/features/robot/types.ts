export type RobotStatus = 'online' | 'offline' | 'connecting' | 'error'

export interface Robot {
  uuid: string
  name?: string | null
  ip?: string | null
  status: RobotStatus
}

export interface RobotListResponse {
  success: boolean
  data: {
    robots: Robot[]
  }
}
