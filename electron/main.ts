import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, Menu, dialog, shell } from 'electron'

const 工作站端口 = 9010
const 工作站地址 = `http://127.0.0.1:${工作站端口}`
const 健康检查地址 = `${工作站地址}/api/v1/health`
const 后端启动超时毫秒 = 30_000

interface RobotPcServer {
  close: () => Promise<void>
  port: number
}

interface RobotPcBackendModule {
  启动RobotPc后端: () => Promise<RobotPcServer>
}

let 主窗口: BrowserWindow | null = null
let 后端服务: RobotPcServer | null = null
let 正在清理退出 = false
const 桌面日志文件 = path.join(os.tmpdir(), 'robot-pc-electron.log')

function 记录桌面日志(message: string, error?: unknown): void {
  const time = new Date().toISOString()
  const detail = error instanceof Error
    ? `\n${error.stack || error.message}`
    : error == null
      ? ''
      : `\n${String(error)}`
  fs.appendFileSync(桌面日志文件, `[${time}] ${message}${detail}\n`, 'utf-8')
}

function 睡眠(毫秒: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 毫秒)
  })
}

function 获取项目根目录(): string {
  return path.resolve(__dirname, '..')
}

function 获取运行资源目录(): { 后端目录: string; 前端目录: string } {
  if (app.isPackaged) {
    return {
      后端目录: path.join(process.resourcesPath, 'backend'),
      前端目录: path.join(process.resourcesPath, 'frontend'),
    }
  }

  const 运行时目录 = path.join(获取项目根目录(), '.cache', 'electron', 'runtime')
  return {
    后端目录: path.join(运行时目录, 'backend'),
    前端目录: path.join(运行时目录, 'frontend'),
  }
}

function 获取预加载脚本路径(): string {
  return path.join(__dirname, 'preload.js')
}

function 读取健康状态(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(健康检查地址, (response) => {
      response.resume()
      resolve((response.statusCode ?? 500) < 400)
    })

    request.on('error', () => {
      resolve(false)
    })
    request.setTimeout(2_000, () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function 等待后端就绪(): Promise<void> {
  const deadline = Date.now() + 后端启动超时毫秒
  while (Date.now() < deadline) {
    if (await 读取健康状态()) {
      return
    }
    await 睡眠(500)
  }
  throw new Error('等待本地后端启动超时')
}

async function 启动后端(): Promise<void> {
  if (后端服务) {
    return
  }

  const { 后端目录, 前端目录 } = 获取运行资源目录()
  const 后端入口文件 = path.join(后端目录, 'dist', 'main.js')
  const 前端入口文件 = path.join(前端目录, 'dist', 'index.html')

  if (!fs.existsSync(后端入口文件)) {
    记录桌面日志(`未找到后端入口文件: ${后端入口文件}`)
    throw new Error(`未找到后端入口文件: ${后端入口文件}`)
  }
  if (!fs.existsSync(前端入口文件)) {
    记录桌面日志(`未找到前端静态资源入口文件: ${前端入口文件}`)
    throw new Error(`未找到前端静态资源入口文件: ${前端入口文件}`)
  }

  process.env.NODE_ENV = app.isPackaged ? 'production' : 'development'
  process.env.PORT = String(工作站端口)
  process.env.ROBOT_STUDIO_HOME = path.join(app.getPath('userData'), 'studio-home')
  process.env.ROBOT_STUDIO_WEB_DIST = path.join(前端目录, 'dist')

  记录桌面日志(`准备加载后端模块: ${后端入口文件}`)
  const 后端模块 = require(后端入口文件) as RobotPcBackendModule
  if (typeof 后端模块.启动RobotPc后端 !== 'function') {
    记录桌面日志(`后端入口未导出 启动RobotPc后端: ${后端入口文件}`)
    throw new Error(`后端入口未导出 启动RobotPc后端: ${后端入口文件}`)
  }

  后端服务 = await 后端模块.启动RobotPc后端()
  记录桌面日志(`后端启动完成，端口: ${后端服务.port}`)
}

async function 停止后端(): Promise<void> {
  if (!后端服务) {
    return
  }
  const currentServer = 后端服务
  后端服务 = null
  await currentServer.close()
}

function 创建主窗口(): BrowserWindow {
  const 窗口 = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    backgroundColor: '#0f172a',
    title: 'Robot PC',
    webPreferences: {
      preload: 获取预加载脚本路径(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  窗口.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  窗口.once('ready-to-show', () => {
    窗口.show()
  })

  void 窗口.loadURL(工作站地址)
  return 窗口
}

async function 初始化应用(): Promise<void> {
  记录桌面日志('开始初始化 Electron 应用')
  Menu.setApplicationMenu(null)
  await 启动后端()
  await 等待后端就绪()
  主窗口 = 创建主窗口()
  记录桌面日志('主窗口创建完成')
}

const 单实例锁 = app.requestSingleInstanceLock()
if (!单实例锁) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!主窗口) {
      return
    }
    if (主窗口.isMinimized()) {
      主窗口.restore()
    }
    主窗口.focus()
  })

  app.whenReady().then(() => {
    void 初始化应用().catch((error) => {
      记录桌面日志('Electron 应用启动失败', error)
      dialog.showErrorBox('Robot PC 启动失败', error instanceof Error ? error.message : String(error))
      app.quit()
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      主窗口 = 创建主窗口()
    }
  })

  app.on('will-quit', (event) => {
    if (!后端服务 || 正在清理退出) {
      return
    }
    event.preventDefault()
    正在清理退出 = true
    void 停止后端().finally(() => {
      app.quit()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
