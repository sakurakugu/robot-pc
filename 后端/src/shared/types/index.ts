export interface ServerMessage<TData = unknown> {
  type: string
  robotId?: string
  timestamp: number
  data?: TData
}

export interface StudioSocketMessageContext {
  role: 'ui' | 'robot'
  robotId?: string
}
