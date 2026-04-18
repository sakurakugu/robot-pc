import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { API_BASE_URL, REQUEST_TIMEOUT } from '@/share/constants'

const request: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
})

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response
    if (data && typeof data.success === 'boolean' && !data.success) {
      const message = data.error || data.message || '请求失败'
      ElMessage.error(message)
      return Promise.reject(new Error(message))
    }
    return response
  },
  (error: AxiosError) => {
    if (error.response) {
      const data = error.response.data as Record<string, unknown> | undefined
      const message = typeof data?.error === 'string'
        ? data.error
        : `请求失败 (${error.response.status})`
      ElMessage.error(message)
      return Promise.reject(error)
    }
    if (error.request) {
      ElMessage.error('网络错误，请检查本地工作站后端')
      return Promise.reject(error)
    }
    ElMessage.error(error.message || '请求异常')
    return Promise.reject(error)
  },
)

export const http = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.get(url, config).then((res) => res.data)
  },
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request.post(url, data, config).then((res) => res.data)
  },
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request.put(url, data, config).then((res) => res.data)
  },
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request.delete(url, config).then((res) => res.data)
  },
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request.patch(url, data, config).then((res) => res.data)
  },
}
