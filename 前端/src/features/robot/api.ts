import axios, { AxiosError } from 'axios'
import { REQUEST_TIMEOUT } from '@/share/constants'
import { http } from '@/share/api/http'
import { CLOUD_BASE_URL_CACHE_KEY, CLOUD_TOKEN_KEY } from '@/features/account/constants'
import type {
  CloudRobotListResponse,
  RobotAccessInfoResponse,
  RobotDiagnosisResponse,
  RobotDiscoveryResponse,
  RobotListResponse,
  SaveRobotPayload,
} from './types'

export function getRobotList(): Promise<RobotListResponse> {
  return http.get('/api/v1/robots')
}

export function discoverLocalRobots(timeoutSeconds: number = 3): Promise<RobotDiscoveryResponse> {
  return http.get(`/api/v1/robots/discover?timeoutSeconds=${encodeURIComponent(String(timeoutSeconds))}`)
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

export function getRobotDiagnosis(uuid: string): Promise<RobotDiagnosisResponse> {
  return http.get(`/api/v1/robots/${encodeURIComponent(uuid)}/diagnosis`)
}

export async function fetchCloudRobotList(): Promise<CloudRobotListResponse> {
  const baseURL = (localStorage.getItem(CLOUD_BASE_URL_CACHE_KEY) || '').trim().replace(/\/+$/, '')
  if (!baseURL) {
    throw new Error('请先在个人中心配置云端地址')
  }

  const token = (localStorage.getItem(CLOUD_TOKEN_KEY) || '').trim()
  if (!token) {
    throw new Error('请先登录云端账号')
  }

  try {
    const response = await axios.get<CloudRobotListResponse>(`${baseURL}/api/v1/robots`, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-client-type': 'web',
        'x-device-name': navigator.userAgent,
      },
    })

    const payload = response.data as CloudRobotListResponse & { message?: string; error?: string }
    if (!payload.success) {
      throw new Error(payload.message || payload.error || '云端请求失败')
    }

    return payload
  } catch (error) {
    throw 规范化云端错误(error)
  }
}

function 规范化云端错误(error: unknown): Error {
  if (!(error instanceof AxiosError)) {
    return error instanceof Error ? error : new Error('云端请求失败')
  }

  if (error.response) {
    const data = error.response.data as Record<string, unknown> | undefined
    const message = typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : `云端请求失败 (${error.response.status})`
    return new Error(message)
  }

  if (error.request) {
    return new Error('无法连接云端，请检查云端地址或服务状态')
  }

  return new Error(error.message || '云端请求异常')
}
