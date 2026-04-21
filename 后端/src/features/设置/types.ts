export interface 云端环境配置 {
  id: string
  name: string
  baseUrl: string
}

export interface StudioUiConfig {
  serverUrl: string
  cloudBaseUrl: string
  cloudEnvironments: 云端环境配置[]
  activeCloudEnvironmentId: string
}

export interface 保存StudioUiConfig输入 {
  cloudBaseUrl?: string | null
  cloudEnvironments?: 云端环境配置[] | null
  activeCloudEnvironmentId?: string | null
}
