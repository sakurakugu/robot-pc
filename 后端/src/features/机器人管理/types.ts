export interface RobotRecord {
  uuid: string
  name: string
  ip: string
  status: 'online' | 'offline' | 'connecting' | 'error'
  serverUrl?: string | null
}
