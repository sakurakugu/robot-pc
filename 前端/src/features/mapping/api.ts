import { http } from '@/share/api/http'
import type { MappingCommand, MappingRuntime, StudioMap } from './types'

const BASE_URL = '/api/v1/mapping'

export const mappingApi = {
  getMaps(): Promise<{ success: boolean; data: { maps: StudioMap[] } }> {
    return http.get(`${BASE_URL}/maps`)
  },

  getRuntime(robotId?: string): Promise<{ success: boolean; data: MappingRuntime }> {
    return http.get(`${BASE_URL}/runtime`, {
      params: robotId ? { robotId } : undefined,
    })
  },

  sendCommand(command: MappingCommand, mapId?: string, robotId?: string): Promise<{ success: boolean; data: MappingRuntime; message: string }> {
    return http.post(`${BASE_URL}/commands`, { command, mapId }, {
      params: robotId ? { robotId } : undefined,
    })
  },

  openMapDirectory(): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/open-map-directory`)
  },
}
