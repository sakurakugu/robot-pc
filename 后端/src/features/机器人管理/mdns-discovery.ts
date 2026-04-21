import Bonjour, { type Service } from 'bonjour-service'
import type { 局域网发现机器人 } from './types'

const 服务类型 = 'sparkrobot'
const 服务协议 = 'tcp'
const 默认扫描超时秒数 = 3

export async function 扫描局域网机器人(timeoutSeconds: number = 默认扫描超时秒数): Promise<局域网发现机器人[]> {
  const bonjour = new Bonjour()
  const results = new Map<string, 局域网发现机器人>()
  const browser = bonjour.find({ type: 服务类型, protocol: 服务协议 }, (service) => {
    const robot = 解析发现服务(service)
    if (!robot) {
      return
    }
    results.set(robot.uuid, robot)
  })

  return new Promise((resolve, reject) => {
    const timeout = Math.max(1, Math.min(15, Math.floor(timeoutSeconds || 默认扫描超时秒数)))

    const 清理资源 = (): void => {
      try {
        browser.stop()
      } catch {
        // 忽略清理阶段错误，避免覆盖主流程结果
      }
      try {
        bonjour.destroy()
      } catch {
        // 忽略清理阶段错误，避免覆盖主流程结果
      }
    }

    const timer = setTimeout(() => {
      清理资源()
      resolve([...results.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')))
    }, timeout * 1000)

    browser.on('error', (error: unknown) => {
      clearTimeout(timer)
      清理资源()
      reject(error instanceof Error ? error : new Error('mDNS 扫描失败'))
    })
  })
}

function 解析发现服务(service: Service): 局域网发现机器人 | null {
  const txt = 读取TXT记录(service.txt)
  const uuid = 读取文本值(txt.uuid)
  if (!uuid) {
    return null
  }

  const ip = 读取文本值(txt.ip) || 获取首个IPv4地址(service.addresses) || ''
  const port = 读取端口(txt.port, service.port)

  return {
    uuid,
    name: 读取文本值(txt.name) || service.name || `机器狗-${uuid.slice(0, 4)}`,
    model: 读取文本值(txt.model) || '',
    version: 读取文本值(txt.version) || '',
    ip,
    port,
  }
}

function 读取TXT记录(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function 读取文本值(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8').trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return ''
}

function 读取端口(txtPort: unknown, fallbackPort: number): number {
  const fromTxt = Number.parseInt(读取文本值(txtPort), 10)
  if (Number.isFinite(fromTxt) && fromTxt > 0) {
    return fromTxt
  }
  return fallbackPort > 0 ? fallbackPort : 0
}

function 获取首个IPv4地址(addresses: string[] | undefined): string {
  if (!Array.isArray(addresses)) {
    return ''
  }
  return addresses.find((address) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) || addresses[0] || ''
}
