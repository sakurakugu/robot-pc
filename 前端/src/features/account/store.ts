import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CLOUD_BASE_URL_CACHE_KEY, CLOUD_TOKEN_KEY, CLOUD_USER_KEY } from './constants'
import {
  getMySessions,
  getProfile,
  getRegisterConfig,
  getStudioUiConfig,
  loginAccount,
  logoutAccount,
  registerAccount,
  revokeSession,
  updateStudioUiConfig,
} from './api'
import type { AuthUser, CloudEnvironment, LoginSession, RegisterResult, StudioUiConfig } from './types'

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error'

const cloudEnvironments = ref<CloudEnvironment[]>([])
const activeCloudEnvironmentId = ref('')
const cloudBaseUrl = computed(() => 获取当前云端环境(cloudEnvironments.value, activeCloudEnvironmentId.value)?.baseUrl || '')
const token = ref(localStorage.getItem(CLOUD_TOKEN_KEY) || '')
const user = ref<AuthUser | null>(解析用户缓存())
const sessions = ref<LoginSession[]>([])
const registerEnabled = ref(true)
const registerApprovalRequired = ref(false)
const connectionState = ref<ConnectionState>(读取已缓存云端地址() ? 'checking' : 'idle')
const connectionMessage = ref(读取已缓存云端地址() ? '正在检查云端连接' : '尚未配置云端地址')
const initialized = ref(false)

let 初始化任务: Promise<void> | null = null

const isAuthenticated = computed(() => Boolean(token.value && user.value))
const currentSessionCount = computed(() => sessions.value.length)

function 持久化云端地址(value: string): void {
  if (value) {
    localStorage.setItem(CLOUD_BASE_URL_CACHE_KEY, value)
  } else {
    localStorage.removeItem(CLOUD_BASE_URL_CACHE_KEY)
  }
}

function 持久化会话(): void {
  if (token.value) {
    localStorage.setItem(CLOUD_TOKEN_KEY, token.value)
  } else {
    localStorage.removeItem(CLOUD_TOKEN_KEY)
  }

  if (user.value) {
    localStorage.setItem(CLOUD_USER_KEY, JSON.stringify(user.value))
  } else {
    localStorage.removeItem(CLOUD_USER_KEY)
  }
}

function 清理会话(): void {
  token.value = ''
  user.value = null
  sessions.value = []
  持久化会话()
}

function 同步UI配置(config: StudioUiConfig): void {
  cloudEnvironments.value = config.cloudEnvironments || []
  activeCloudEnvironmentId.value = config.activeCloudEnvironmentId || config.cloudEnvironments?.[0]?.id || ''
  持久化云端地址(config.cloudBaseUrl || 获取当前云端环境(cloudEnvironments.value, activeCloudEnvironmentId.value)?.baseUrl || '')
}

async function 加载本地云端配置(): Promise<StudioUiConfig> {
  const response = await getStudioUiConfig()
  同步UI配置(response.data)
  return response.data
}

async function 检查云端连接(silentError: boolean = false): Promise<boolean> {
  if (!cloudBaseUrl.value) {
    connectionState.value = 'idle'
    connectionMessage.value = '尚未配置云端地址'
    registerEnabled.value = true
    registerApprovalRequired.value = false
    return false
  }

  connectionState.value = 'checking'
  connectionMessage.value = '正在检查云端连接'

  try {
    const response = await getRegisterConfig({ silentError })
    registerEnabled.value = response.data.registerEnabled
    registerApprovalRequired.value = response.data.registerApprovalRequired
    connectionState.value = 'connected'
    connectionMessage.value = '云端连接正常'
    return true
  } catch {
    connectionState.value = 'error'
    connectionMessage.value = '无法连接到当前云端地址'
    return false
  }
}

async function 恢复当前账号(silentError: boolean = true): Promise<void> {
  if (!token.value || !cloudBaseUrl.value) {
    return
  }

  try {
    const response = await getProfile({ silentError })
    user.value = response.data
    持久化会话()
  } catch {
    清理会话()
  }
}

async function 初始化(): Promise<void> {
  if (initialized.value) {
    return
  }
  if (初始化任务) {
    return 初始化任务
  }

  初始化任务 = (async () => {
    try {
      await 加载本地云端配置()
      const reachable = await 检查云端连接(true)
      if (reachable) {
        await 恢复当前账号(true)
        if (isAuthenticated.value) {
          await 刷新登录设备(true)
        }
      }
    } finally {
      initialized.value = true
      初始化任务 = null
    }
  })()

  return 初始化任务
}

async function 保存云端地址(value: string): Promise<StudioUiConfig> {
  const currentEnvironment = 获取当前云端环境(cloudEnvironments.value, activeCloudEnvironmentId.value)
  const nextEnvironments = currentEnvironment
    ? cloudEnvironments.value.map((item) => (item.id === currentEnvironment.id ? { ...item, baseUrl: value.trim().replace(/\/+$/, '') } : item))
    : cloudEnvironments.value
  const response = await updateStudioUiConfig({
    cloudBaseUrl: value,
    cloudEnvironments: nextEnvironments,
    activeCloudEnvironmentId: activeCloudEnvironmentId.value,
  })
  const previousBaseUrl = cloudBaseUrl.value
  同步UI配置(response.data)
  if (previousBaseUrl !== response.data.cloudBaseUrl) {
    清理会话()
  }
  await 检查云端连接(false)
  return response.data
}

async function 保存云端环境配置(payload: {
  cloudEnvironments: CloudEnvironment[]
  activeCloudEnvironmentId: string
}): Promise<StudioUiConfig> {
  const response = await updateStudioUiConfig(payload)
  const previousBaseUrl = cloudBaseUrl.value
  同步UI配置(response.data)
  if (previousBaseUrl !== response.data.cloudBaseUrl) {
    清理会话()
  }
  await 检查云端连接(false)
  return response.data
}

async function 登录(username: string, password: string) {
  const response = await loginAccount({ username, password })
  token.value = response.data.token
  user.value = response.data.user
  持久化会话()
  await 刷新登录设备(true)
  return response.data
}

async function 注册(username: string, password: string): Promise<RegisterResult> {
  const response = await registerAccount({ username, password })
  if (response.data.token && response.data.user) {
    token.value = response.data.token
    user.value = response.data.user
    持久化会话()
    await 刷新登录设备(true)
  } else {
    清理会话()
  }
  return response.data
}

async function 刷新账号信息(silentError: boolean = false): Promise<void> {
  if (!token.value) {
    return
  }
  const response = await getProfile({ silentError })
  user.value = response.data
  持久化会话()
}

async function 退出登录(): Promise<void> {
  try {
    if (token.value) {
      await logoutAccount({ silentError: true })
    }
  } finally {
    清理会话()
  }
}

async function 刷新登录设备(silentError: boolean = false): Promise<LoginSession[]> {
  if (!isAuthenticated.value) {
    sessions.value = []
    return []
  }
  const response = await getMySessions({ silentError })
  sessions.value = response.data
  return sessions.value
}

async function 下线设备(id: string): Promise<void> {
  await revokeSession(id)
  ElMessage.success('设备已下线')
  await 刷新登录设备(true)
}

function 读取连接状态文本(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return '已连接'
    case 'checking':
      return '检查中'
    case 'error':
      return '连接失败'
    default:
      return '未配置'
  }
}

export function useCloudAccountStore() {
  return {
    cloudEnvironments,
    activeCloudEnvironmentId,
    cloudBaseUrl,
    activeCloudEnvironment: computed(() => 获取当前云端环境(cloudEnvironments.value, activeCloudEnvironmentId.value)),
    token,
    user,
    sessions,
    registerEnabled,
    registerApprovalRequired,
    connectionState,
    connectionMessage,
    initialized,
    isAuthenticated,
    currentSessionCount,
    connectionStatusText: computed(() => 读取连接状态文本(connectionState.value)),
    initialize: 初始化,
    loadStudioConfig: 加载本地云端配置,
    saveCloudBaseUrl: 保存云端地址,
    saveCloudEnvironmentConfig: 保存云端环境配置,
    checkCloudConnection: 检查云端连接,
    restoreProfileIfNeeded: 恢复当前账号,
    refreshProfile: 刷新账号信息,
    refreshSessions: 刷新登录设备,
    login: 登录,
    register: 注册,
    logout: 退出登录,
    revokeSession: 下线设备,
  }
}

function 解析用户缓存(): AuthUser | null {
  const raw = localStorage.getItem(CLOUD_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function 获取当前云端环境(
  environments: CloudEnvironment[],
  activeId: string,
): CloudEnvironment | null {
  return environments.find((item) => item.id === activeId)
    || environments[0]
    || null
}

function 读取已缓存云端地址(): string {
  return (localStorage.getItem(CLOUD_BASE_URL_CACHE_KEY) || '').trim()
}
