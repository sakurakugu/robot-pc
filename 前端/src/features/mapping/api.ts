import { http } from '@/share/api/http'
import type {
  MapDownloadResult,
  MappingRequest,
  MappingRuntime,
  RemoteMapList,
  StudioMap,
  WaypointFile,
  WaypointFileDetail,
} from './types'

const BASE_URL = '/api/v1/mapping'

export const mappingApi = {
  getMaps(): Promise<{ success: boolean; data: { maps: StudioMap[] } }> {
    return http.get(`${BASE_URL}/maps`)
  },

  getRemoteMaps(robotId: string): Promise<{ success: boolean; data: RemoteMapList }> {
    return http.get(`${BASE_URL}/remote-maps`, {
      params: { robotId },
    })
  },

  downloadRemoteMap(robotId: string, mapId: string): Promise<{ success: boolean; data: MapDownloadResult; message: string }> {
    return http.post(`${BASE_URL}/remote-maps/${encodeURIComponent(mapId)}/download`, undefined, {
      params: { robotId },
    })
  },

  getWaypoints(): Promise<{ success: boolean; data: { waypoints: WaypointFile[] } }> {
    return http.get(`${BASE_URL}/waypoints`)
  },

  getWaypointDetail(waypointId: string): Promise<{ success: boolean; data: { waypoint: WaypointFileDetail } }> {
    return http.get(`${BASE_URL}/waypoints/${encodeURIComponent(waypointId)}`)
  },

  getRuntime(robotId?: string): Promise<{ success: boolean; data: MappingRuntime }> {
    return http.get(`${BASE_URL}/runtime`, {
      params: robotId ? { robotId } : undefined,
    })
  },

  sendCommand(payload: MappingRequest, robotId?: string): Promise<{ success: boolean; data: MappingRuntime; message: string }> {
    return http.post(`${BASE_URL}/commands`, payload, {
      params: robotId ? { robotId } : undefined,
    })
  },

  openMapDirectory(): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/open-map-directory`)
  },

  openWaypointDirectory(): Promise<{ success: boolean; message: string }> {
    return http.post(`${BASE_URL}/open-waypoint-directory`)
  },
}
