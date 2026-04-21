import fs from 'node:fs'
import path from 'node:path'
import 配置 from '../../infra/config'
import type { RobotRecord, 保存机器人输入 } from './types'

export interface RobotRepository {
  listRobots(): Promise<RobotRecord[]>
  getRobot(uuid: string): Promise<RobotRecord | undefined>
  saveRobot(input: 保存机器人输入): Promise<RobotRecord>
  deleteRobot(uuid: string): Promise<boolean>
}
const 示例机器人UUID集合 = new Set(['demo-x2-001', 'demo-d1-001'])

export class 本地机器人仓库 implements RobotRepository {
  private readonly 文件路径 = path.join(配置.数据目录, 'robots.json')

  async listRobots(): Promise<RobotRecord[]> {
    return this.读取机器人列表()
  }

  async getRobot(uuid: string): Promise<RobotRecord | undefined> {
    const robots = await this.读取机器人列表()
    return robots.find((item) => item.uuid === uuid)
  }

  async saveRobot(input: 保存机器人输入): Promise<RobotRecord> {
    const robots = await this.读取机器人列表()
    const existing = robots.find((item) => item.uuid === input.uuid.trim())
    const record = 规范化机器人记录({
      uuid: input.uuid.trim(),
      name: 规范化可选文本(input.name),
      model: 规范化可选文本(input.model),
      ip: 规范化可选文本(input.ip),
      group_name: 规范化可选文本(input.group_name),
      tags: 规范化标签(input.tags),
      sn: 规范化可选文本(input.sn),
      status: existing?.status ?? 'offline',
      serverUrl: 规范化可选文本(input.serverUrl),
    })

    const index = robots.findIndex((item) => item.uuid === record.uuid)
    if (index >= 0) {
      robots[index] = {
        ...robots[index],
        ...record,
      }
    } else {
      robots.push(record)
    }

    await this.写入机器人列表(robots)
    return record
  }

  async deleteRobot(uuid: string): Promise<boolean> {
    const robots = await this.读取机器人列表()
    const filtered = robots.filter((item) => item.uuid !== uuid)
    if (filtered.length === robots.length) {
      return false
    }
    await this.写入机器人列表(filtered)
    return true
  }

  private async 读取机器人列表(): Promise<RobotRecord[]> {
    await fs.promises.mkdir(path.dirname(this.文件路径), { recursive: true })

    try {
      const raw = await fs.promises.readFile(this.文件路径, 'utf-8')
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) {
        await this.写入机器人列表([])
        return []
      }

      const normalized = data
        .map(规范化机器人记录)
        .filter((robot) => !示例机器人UUID集合.has(robot.uuid))

      if (normalized.length !== data.length) {
        await this.写入机器人列表(normalized)
      }

      return normalized
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        await this.写入机器人列表([])
        return []
      }
      throw error
    }
  }

  private async 写入机器人列表(robots: RobotRecord[]): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.文件路径), { recursive: true })
    await fs.promises.writeFile(this.文件路径, JSON.stringify(robots, null, 2), 'utf-8')
  }
}

function 规范化机器人记录(record: RobotRecord): RobotRecord {
  const ip = 规范化可选文本(record.ip)
  const serverUrl = 规范化可选文本(record.serverUrl)
  return {
    ...record,
    name: 规范化可选文本(record.name),
    model: 规范化可选文本(record.model),
    ip,
    group_name: 规范化可选文本(record.group_name),
    tags: 规范化标签(record.tags),
    sn: 规范化可选文本(record.sn),
    serverUrl: serverUrl || (ip ? `http://${ip}:8080` : null),
  }
}

function 规范化可选文本(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  return text.length > 0 ? text : null
}

function 规范化标签(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}
