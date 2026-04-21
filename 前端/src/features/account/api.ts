import { REQUEST_TIMEOUT } from '@/share/constants'
import { http } from '@/share/api/http'
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { CLOUD_BASE_URL_CACHE_KEY, CLOUD_TOKEN_KEY } from './constants'
import type { ApiResp, AuthPayload, AuthUser, LoginSession, RegisterConfig, RegisterResult, StudioUiConfig } from './types'

type CloudRequestConfig = AxiosRequestConfig & {
  silentError?: boolean
}

const cloudRequest: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
})

cloudRequest.interceptors.request.use((config) => {
  const baseURL = 读取云端地址缓存()
  if (!baseURL) {
    return Promise.reject(new Error('请先配置云端地址'))
  }

  const headers = config.headers ?? {}
  const token = localStorage.getItem(CLOUD_TOKEN_KEY) || ''
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  headers['x-client-type'] = 'web'
  headers['x-device-name'] = navigator.userAgent

  config.baseURL = baseURL
  config.headers = headers
  return config
})

cloudRequest.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    if (data && typeof data.success === 'boolean' && !data.success) {
      const message = data.error || data.message || '云端请求失败'
      ElMessage.error(message)
      return Promise.reject(new Error(message))
    }
    return response
  },
  (error: AxiosError) => {
    const silentError = Boolean((error.config as CloudRequestConfig | undefined)?.silentError)
    const showError = (message: string) => {
      if (!silentError) {
        ElMessage.error(message)
      }
    }

    if (error.response) {
      const data = error.response.data as Record<string, unknown> | undefined
      const message = typeof data?.error === 'string'
        ? data.error
        : `云端请求失败 (${error.response.status})`
      showError(message)
      return Promise.reject(error)
    }

    if (error.request) {
      showError('无法连接云端，请检查云端地址或服务状态')
      return Promise.reject(error)
    }

    showError(error.message || '云端请求异常')
    return Promise.reject(error)
  },
)

export function getStudioUiConfig(): Promise<ApiResp<StudioUiConfig>> {
  return http.get('/api/v1/config/ui')
}

export function updateStudioUiConfig(payload: { cloudBaseUrl: string }): Promise<ApiResp<StudioUiConfig>> {
  return http.put('/api/v1/config/ui', payload)
}

export function getRegisterConfig(config?: CloudRequestConfig): Promise<ApiResp<RegisterConfig>> {
  return cloudRequest.get('/api/v1/auth/register-config', config).then((res) => res.data)
}

export function loginAccount(
  payload: { username: string; password: string },
  config?: CloudRequestConfig,
): Promise<ApiResp<AuthPayload>> {
  return cloudRequest.post('/api/v1/auth/login', payload, config).then((res) => res.data)
}

export function registerAccount(
  payload: { username: string; password: string },
  config?: CloudRequestConfig,
): Promise<ApiResp<RegisterResult>> {
  return cloudRequest.post('/api/v1/auth/register', payload, config).then((res) => res.data)
}

export function getProfile(config?: CloudRequestConfig): Promise<ApiResp<AuthUser>> {
  return cloudRequest.get('/api/v1/auth/me', config).then((res) => res.data)
}

export function logoutAccount(config?: CloudRequestConfig): Promise<ApiResp<{ success: boolean }>> {
  return cloudRequest.post('/api/v1/auth/logout', undefined, config).then((res) => res.data)
}

export function getMySessions(config?: CloudRequestConfig): Promise<ApiResp<LoginSession[]>> {
  return cloudRequest.get('/api/v1/auth/sessions', config).then((res) => res.data)
}

export function revokeSession(id: string, config?: CloudRequestConfig): Promise<ApiResp<{ success: boolean }>> {
  return cloudRequest.delete(`/api/v1/auth/sessions/${id}`, config).then((res) => res.data)
}

function 读取云端地址缓存(): string {
  return (localStorage.getItem(CLOUD_BASE_URL_CACHE_KEY) || '').trim()
}
