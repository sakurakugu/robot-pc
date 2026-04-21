import fs from 'node:fs'
import path from 'node:path'
import 配置 from '../../infra/config'
import type { StudioUiConfig, 云端环境配置 } from './types'

const 默认活跃云端环境ID = 'server'
const 默认云端环境列表: 云端环境配置[] = [
  {
    id: 'server',
    name: '服务器环境',
    baseUrl: 'http://106.53.174.61',
  },
  {
    id: 'local',
    name: '本机开发',
    baseUrl: 'http://127.0.0.1:9000',
  },
]

const 默认配置: StudioUiConfig = {
  serverUrl: '',
  cloudBaseUrl: 默认云端环境列表[0]?.baseUrl || '',
  cloudEnvironments: 创建默认云端环境列表(),
  activeCloudEnvironmentId: 默认活跃云端环境ID,
}

export class 本地工作站设置仓库 {
  private readonly 文件路径 = path.join(配置.数据目录, 'studio-config.json')

  async 读取UI配置(): Promise<StudioUiConfig> {
    await fs.promises.mkdir(path.dirname(this.文件路径), { recursive: true })

    try {
      const raw = await fs.promises.readFile(this.文件路径, 'utf-8')
      const parsed = JSON.parse(raw)
      return 规范化UI配置(parsed)
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        await this.写入UI配置(默认配置)
        return 默认配置
      }
      throw error
    }
  }

  async 保存UI配置(input: Partial<StudioUiConfig>): Promise<StudioUiConfig> {
    const current = await this.读取UI配置()
    const next = 规范化UI配置({
      ...current,
      ...input,
    })
    await this.写入UI配置(next)
    return next
  }

  private async 写入UI配置(config: StudioUiConfig): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.文件路径), { recursive: true })
    await fs.promises.writeFile(this.文件路径, JSON.stringify(config, null, 2), 'utf-8')
  }
}

function 规范化UI配置(input: unknown): StudioUiConfig {
  const data = typeof input === 'object' && input ? input as Record<string, unknown> : {}
  const cloudEnvironments = 合并云端环境列表(data.cloudEnvironments)
  const legacyCloudBaseUrl = 规范化云端地址(data.cloudBaseUrl)
  const migratedCloudEnvironments = 迁移旧云端地址(cloudEnvironments, legacyCloudBaseUrl)
  const activeCloudEnvironmentId = 规范化活跃云端环境ID(
    data.activeCloudEnvironmentId,
    migratedCloudEnvironments,
  )
  const activeCloudEnvironment = migratedCloudEnvironments.find((item) => item.id === activeCloudEnvironmentId)
    || migratedCloudEnvironments[0]

  return {
    serverUrl: '',
    cloudBaseUrl: activeCloudEnvironment?.baseUrl || '',
    cloudEnvironments: migratedCloudEnvironments,
    activeCloudEnvironmentId: activeCloudEnvironment?.id || 默认活跃云端环境ID,
  }
}

function 规范化云端地址(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.replace(/\/+$/, '')
}

function 创建默认云端环境列表(): 云端环境配置[] {
  return 默认云端环境列表.map((item) => ({ ...item }))
}

function 是否默认云端环境(id: string): boolean {
  return 默认云端环境列表.some((item) => item.id === id)
}

function 合并云端环境列表(value: unknown): 云端环境配置[] {
  const items = Array.isArray(value) ? value : []
  const normalizedItems = 规范化云端环境数组(items)

  if (normalizedItems.length === 0) {
    return 创建默认云端环境列表()
  }

  const itemMap = new Map(normalizedItems.map((item) => [item.id, item]))
  const mergedDefaults = 默认云端环境列表.map((item) => itemMap.get(item.id) || { ...item })
  const customOnly = normalizedItems.filter((item) => !是否默认云端环境(item.id))
  return [...mergedDefaults, ...customOnly]
}

function 规范化云端环境数组(items: unknown[]): 云端环境配置[] {
  const result: 云端环境配置[] = []
  const usedIds = new Set<string>()

  for (const item of items) {
    if (typeof item !== 'object' || !item) {
      continue
    }

    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const baseUrl = 规范化云端地址(record.baseUrl)

    if (!id || !name || !baseUrl || usedIds.has(id)) {
      continue
    }

    result.push({ id, name, baseUrl })
    usedIds.add(id)
  }

  return result
}

function 迁移旧云端地址(
  cloudEnvironments: 云端环境配置[],
  legacyCloudBaseUrl: string,
): 云端环境配置[] {
  if (!legacyCloudBaseUrl) {
    return cloudEnvironments
  }

  const matchedEnvironment = cloudEnvironments.find((item) => item.baseUrl === legacyCloudBaseUrl)
  if (matchedEnvironment) {
    return cloudEnvironments
  }

  return [
    ...cloudEnvironments,
    {
      id: 'custom-migrated',
      name: '迁移环境',
      baseUrl: legacyCloudBaseUrl,
    },
  ]
}

function 规范化活跃云端环境ID(value: unknown, cloudEnvironments: 云端环境配置[]): string {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (candidate && cloudEnvironments.some((item) => item.id === candidate)) {
    return candidate
  }

  if (cloudEnvironments.some((item) => item.id === 默认活跃云端环境ID)) {
    return 默认活跃云端环境ID
  }

  return cloudEnvironments[0]?.id || 默认活跃云端环境ID
}
