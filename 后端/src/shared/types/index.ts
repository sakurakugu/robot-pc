export interface ServerMessage<TData = unknown> {
  type: string
  robotId?: string
  timestamp: number
  data?: TData
}

export interface RuntimeManualCommandData {
  command: 'start_session' | 'update_velocity' | 'stop' | 'emergency_stop'
  mode?: 'move' | 'pose' | 'two_leg'
  vx?: number
  vy?: number
  wz?: number
  source?: string
  session_id?: string
  enabled?: boolean
}

export interface RuntimeActionCommandData {
  action_name?: string
  action_id?: string
  source?: string
  parameters?: Record<string, unknown>
}

export interface StudioSocketMessageContext {
  role: 'ui' | 'robot'
  robotId?: string
}
