import fs from 'node:fs'
import path from 'node:path'
import 配置 from '../../infra/config'
import type { RobotRecord } from './types'

export interface RobotRepository {
  listRobots(): Promise<RobotRecord[]>
  getRobot(uuid: string): Promise<RobotRecord | undefined>
}

const 示例机器人: RobotRecord[] = [
  {
    uuid: 'demo-x2-001',
    name: '示例 X2 机器人',
    ip: '192.168.1.101',
    status: 'offline',
    serverUrl: 'http://192.168.1.101:8080',
  },
  {
    uuid: 'demo-d1-001',
    name: '示例 D1 机器人',
    ip: '192.168.1.102',
    status: 'offline',
    serverUrl: 'http://192.168.1.102:8080',
  },
]

export class 本地机器人仓库 implements RobotRepository {
  private readonly 文件路径 = path.join(配置.数据目录, 'robots.json')

  async listRobots(): Promise<RobotRecord[]> {
    return this.读取机器人列表()
  }

  async getRobot(uuid: string): Promise<RobotRecord | undefined> {
    const robots = await this.读取机器人列表()
    return robots.find((item) => item.uuid === uuid)
  }

  private async 读取机器人列表(): Promise<RobotRecord[]> {
    await fs.promises.mkdir(path.dirname(this.文件路径), { recursive: true })

    try {
      const raw = await fs.promises.readFile(this.文件路径, 'utf-8')
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) {
        return 示例机器人
      }
      return data.map(规范化机器人记录)
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        await fs.promises.writeFile(this.文件路径, JSON.stringify(示例机器人, null, 2), 'utf-8')
        return 示例机器人
      }
      throw error
    }
  }
}

function 规范化机器人记录(record: RobotRecord): RobotRecord {
  return {
    ...record,
    serverUrl: record.serverUrl || `http://${record.ip}:8080`,
  }
}
