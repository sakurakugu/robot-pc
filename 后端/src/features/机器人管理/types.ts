export interface RobotRecord {
  uuid: string
  name: string
  ip: string
  status: 'online' | 'offline' | 'connecting' | 'error'
  serverUrl?: string | null
}

export interface 保存机器人输入 {
  uuid: string
  name: string
  ip: string
  serverUrl?: string | null
}

export interface 工作站接入候选 {
  label: string
  host: string
  businessUrlTemplate: string
}

export type 机器人探测状态 = 'ok' | 'timeout' | 'refused' | 'error' | 'invalid' | 'missing'

export interface 机器人探测结果 {
  status: 机器人探测状态
  message: string
  url: string | null
  httpStatus: number | null
  durationMs: number | null
  checkedAt: string
}

export interface 工作站通道诊断结果 {
  status: 'connected' | 'disconnected'
  connected: boolean
  message: string
  checkedAt: string
}

export interface 机器人连接诊断结果 {
  robot: RobotRecord
  checkedAt: string
  server: 机器人探测结果
  runtime: 机器人探测结果
  telemetry: 机器人探测结果
  workstationWebsocket: 工作站通道诊断结果
}
