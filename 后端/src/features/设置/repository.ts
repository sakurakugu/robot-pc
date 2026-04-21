import fs from 'node:fs'
import path from 'node:path'
import 配置 from '../../infra/config'
import type { StudioUiConfig } from './types'

const 默认配置: StudioUiConfig = {
  serverUrl: '',
  cloudBaseUrl: '',
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
  return {
    serverUrl: '',
    cloudBaseUrl: 规范化云端地址(data.cloudBaseUrl),
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

  return trimmed.replace(/\/+$/, '');

}

