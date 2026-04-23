import { http } from '@/share/api/http'
import type { OnboardToolInfo, OnboardToolJob, StartOnboardToolJobPayload } from './types'

const BASE_URL = '/api/v1/developer/onboard-tools'

interface ApiData<T> {
  data: T
  message?: string
}

export const developerApi = {
  getOnboardToolInfo(): Promise<ApiData<OnboardToolInfo>> {
    return http.get(`${BASE_URL}/info`)
  },
  getOnboardToolJobs(): Promise<ApiData<{ jobs: OnboardToolJob[] }>> {
    return http.get(`${BASE_URL}/jobs`)
  },
  getOnboardToolJob(jobId: string): Promise<ApiData<OnboardToolJob>> {
    return http.get(`${BASE_URL}/jobs/${encodeURIComponent(jobId)}`)
  },
  startOnboardToolJob(payload: StartOnboardToolJobPayload): Promise<ApiData<OnboardToolJob>> {
    return http.post(`${BASE_URL}/jobs`, payload)
  },
}
