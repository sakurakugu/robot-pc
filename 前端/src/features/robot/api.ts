import { http } from '@/share/api/http'
import type { RobotListResponse } from './types'

export function getRobotList(): Promise<RobotListResponse> {
  return http.get('/api/v1/robots')
}
