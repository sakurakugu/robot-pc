import { http } from '@/share/api/http'
import type { RobotAccessInfoResponse, RobotListResponse, SaveRobotPayload } from './types'

export function getRobotList(): Promise<RobotListResponse> {
  return http.get('/api/v1/robots')
}

export function getRobotAccessInfo(): Promise<RobotAccessInfoResponse> {
  return http.get('/api/v1/robots/access-info')
}

export function saveRobot(payload: SaveRobotPayload): Promise<{ success: boolean; data: { robot: SaveRobotPayload }; message: string }> {
  return http.post('/api/v1/robots', payload)
}

export function deleteRobot(uuid: string): Promise<{ success: boolean; message: string }> {
  return http.delete(`/api/v1/robots/${uuid}`)
}
