import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { v7 as uuidv7 } from 'uuid'
import { Http错误工厂 } from '../../shared/http/errors'
import type {
  启动本体工具任务请求,
  本体工具任务模式,
  本体工具任务名称,
  本体工具任务记录,
  本体工具打包格式,
} from './types'

const 支持的任务: 本体工具任务名称[] = ['common', 'server', 'agent', 'runtime', 'ros', 'full']
const 支持的格式: 本体工具打包格式[] = ['tar.gz', 'zip', 'tar', 'tar.bz2', 'tar.xz']
const 最大日志长度 = 300_000

export class 开发者工具服务 {
  private readonly 任务记录 = new Map<string, 本体工具任务记录>()

  获取本体工具信息(): Record<string, unknown> {
    const onboardDir = this.解析本体目录()
    return {
      onboardDir,
      scriptPath: path.join(onboardDir, 'tools', '1.常用命令.py'),
      pythonCommand: this.获取Python命令(),
      supportedTasks: 支持的任务,
      supportedFormats: 支持的格式,
      runningJobs: [...this.任务记录.values()]
        .filter((任务) => 任务.status === 'running')
        .map((任务) => this.导出任务记录(任务)),
    }
  }

  启动本体工具任务(请求: 启动本体工具任务请求): 本体工具任务记录 {
    const mode = this.校验模式(请求.mode)
    const task = this.校验任务(mode, 请求.task)
    const format = this.校验格式(请求.format)
    const onboardDir = this.解析本体目录()
    const scriptPath = path.join(onboardDir, 'tools', '1.常用命令.py')
    if (!fs.existsSync(scriptPath)) {
      throw Http错误工厂.未找到(`未找到本体工具脚本: ${scriptPath}`, 'ONBOARD_TOOL_SCRIPT_NOT_FOUND')
    }

    const args = this.构建脚本参数(scriptPath, mode, task, format, 请求)
    const command = this.获取Python命令()
    const now = new Date().toISOString()
    const 记录: 本体工具任务记录 = {
      id: uuidv7(),
      mode,
      task,
      status: 'running',
      command,
      args,
      cwd: onboardDir,
      startedAt: now,
      finishedAt: null,
      exitCode: null,
      logs: '',
      error: null,
    }

    this.任务记录.set(记录.id, 记录)
    this.运行任务进程(记录)
    return this.导出任务记录(记录)
  }

  获取任务记录(jobId: string): 本体工具任务记录 {
    const 记录 = this.任务记录.get(jobId)
    if (!记录) {
      throw Http错误工厂.未找到('未找到开发者工具任务', 'DEVELOPER_JOB_NOT_FOUND')
    }
    return this.导出任务记录(记录)
  }

  获取任务列表(): 本体工具任务记录[] {
    return [...this.任务记录.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20)
      .map((任务) => this.导出任务记录(任务))
  }

  private 运行任务进程(记录: 本体工具任务记录): void {
    let child
    try {
      child = spawn(记录.command, 记录.args, {
        cwd: 记录.cwd,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
        },
        windowsHide: true,
      })
    } catch (error) {
      记录.status = 'failed'
      记录.finishedAt = new Date().toISOString()
      记录.error = error instanceof Error ? error.message : '启动任务失败'
      this.追加日志(记录, `\n启动任务失败: ${记录.error}\n`)
      return
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.追加日志(记录, chunk))
    child.stderr.on('data', (chunk: string) => this.追加日志(记录, chunk))
    child.on('error', (error) => {
      记录.status = 'failed'
      记录.error = error.message
      记录.finishedAt = new Date().toISOString()
      this.追加日志(记录, `\n任务进程异常: ${error.message}\n`)
    })
    child.on('close', (code) => {
      if (记录.finishedAt) {
        return
      }
      记录.exitCode = code
      记录.status = code === 0 ? 'success' : 'failed'
      记录.finishedAt = new Date().toISOString()
      if (code !== 0) {
        记录.error = `任务退出码 ${code ?? 'unknown'}`
      }
      this.追加日志(记录, `\n任务结束，退出码: ${code ?? 'unknown'}\n`)
    })
  }

  private 追加日志(记录: 本体工具任务记录, chunk: string): void {
    记录.logs += chunk
    if (记录.logs.length > 最大日志长度) {
      记录.logs = 记录.logs.slice(-最大日志长度)
    }
  }

  private 构建脚本参数(
    scriptPath: string,
    mode: 本体工具任务模式,
    task: 本体工具任务名称,
    format: 本体工具打包格式,
    请求: 启动本体工具任务请求,
  ): string[] {
    const args = [scriptPath]
    if (mode === 'package') {
      args.push('--package', task, '--format', format)
      return args
    }

    const robotIp = this.校验机器人IP(请求.robotIp)
    if (mode === 'install') {
      args.push('--install', task, '--robot-ip', robotIp, '--format', format)
      return args
    }

    return args
  }

  private 解析本体目录(): string {
    const candidates = [
      process.env.ROBOT_ONBOARD_DIR,
      path.resolve(__dirname, '../../../../../robot-onboard'),
      path.resolve(process.cwd(), '../robot-onboard'),
      path.resolve(process.cwd(), '../../robot-onboard'),
      path.resolve(process.cwd(), 'repos/robot-onboard'),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    for (const candidate of candidates) {
      const resolved = path.resolve(candidate)
      if (fs.existsSync(path.join(resolved, 'tools', '1.常用命令.py'))) {
        return resolved
      }
    }

    throw Http错误工厂.未找到(
      '未找到 repos/robot-onboard，请设置 ROBOT_ONBOARD_DIR 指向本体仓库目录',
      'ONBOARD_DIR_NOT_FOUND',
    )
  }

  private 获取Python命令(): string {
    return process.env.ROBOT_PC_PYTHON || process.env.PYTHON || 'python'
  }

  private 校验模式(mode: unknown): 本体工具任务模式 {
    if (mode === 'package' || mode === 'install') {
      return mode
    }
    throw Http错误工厂.参数错误('开发者工具任务模式无效', 'INVALID_DEVELOPER_TOOL_MODE')
  }

  private 校验任务(_mode: 本体工具任务模式, task: unknown): 本体工具任务名称 {
    if (typeof task === 'string' && 支持的任务.includes(task as 本体工具任务名称)) {
      return task as 本体工具任务名称
    }
    throw Http错误工厂.参数错误('请选择有效的本体工具任务', 'INVALID_ONBOARD_TOOL_TASK')
  }

  private 校验格式(format: unknown): 本体工具打包格式 {
    if (format === undefined || format === null || format === '') {
      return 'tar.gz'
    }
    if (typeof format === 'string' && 支持的格式.includes(format as 本体工具打包格式)) {
      return format as 本体工具打包格式
    }
    throw Http错误工厂.参数错误('打包格式无效', 'INVALID_PACKAGE_FORMAT')
  }

  private 校验机器人IP(robotIp: unknown): string {
    if (typeof robotIp !== 'string' || robotIp.trim().length === 0) {
      throw Http错误工厂.参数错误('SSH 安装需要填写机器狗 IP', 'ROBOT_IP_REQUIRED')
    }
    const normalized = robotIp.trim()
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
      throw Http错误工厂.参数错误('机器狗 IP 格式无效', 'INVALID_ROBOT_IP')
    }
    return normalized
  }

  private 导出任务记录(记录: 本体工具任务记录): 本体工具任务记录 {
    return {
      ...记录,
      args: [...记录.args],
    }
  }
}
