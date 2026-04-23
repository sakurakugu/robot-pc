export type OnboardToolMode = 'package' | 'install'
export type OnboardToolJobStatus = 'running' | 'success' | 'failed'
export type OnboardToolTask = 'common' | 'server' | 'agent' | 'runtime' | 'ros' | 'full'
export type OnboardToolPackageFormat = 'tar.gz' | 'zip' | 'tar' | 'tar.bz2' | 'tar.xz'

export interface StartOnboardToolJobPayload {
  mode: OnboardToolMode
  task?: OnboardToolTask
  robotIp?: string
  format?: OnboardToolPackageFormat
}

export interface OnboardToolJob {
  id: string
  mode: OnboardToolMode
  task: OnboardToolTask
  status: OnboardToolJobStatus
  command: string
  args: string[]
  cwd: string
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  logs: string
  error: string | null
}

export interface OnboardToolInfo {
  onboardDir: string
  scriptPath: string
  pythonCommand: string
  supportedTasks: OnboardToolTask[]
  supportedFormats: OnboardToolPackageFormat[]
  runningJobs: OnboardToolJob[]
}
