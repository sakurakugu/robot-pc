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
