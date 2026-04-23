export type 本体工具任务模式 = 'package' | 'install'
export type 本体工具任务状态 = 'running' | 'success' | 'failed'
export type 本体工具任务名称 = 'common' | 'server' | 'agent' | 'runtime' | 'ros' | 'full'
export type 本体工具打包格式 = 'tar.gz' | 'zip' | 'tar' | 'tar.bz2' | 'tar.xz'

export interface 启动本体工具任务请求 {
  mode: 本体工具任务模式
  task?: 本体工具任务名称
  robotIp?: string
  format?: 本体工具打包格式
}

export interface 本体工具任务记录 {
  id: string
  mode: 本体工具任务模式
  task: 本体工具任务名称
  status: 本体工具任务状态
  command: string
  args: string[]
  cwd: string
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  logs: string
  error: string | null
}
