import type { RobotRecord, 工作站通道诊断结果, 机器人探测结果, 机器人连接诊断结果 } from './types'

interface 接口探测选项 {
  成功消息: string
  无效响应消息: string
  响应有效: (payload: Record<string, unknown>) => boolean
}

const 探测超时时间毫秒 = 2500

export async function 诊断机器人连接(
  机器人: RobotRecord,
  工作站业务通道已连接: boolean,
): Promise<机器人连接诊断结果> {
  const checkedAt = new Date().toISOString()
  const serverUrl = 规范化机器人服务地址(机器人)
  const workstationWebsocket = 构建工作站通道诊断结果(工作站业务通道已连接, checkedAt)

  if (!serverUrl) {
    const 缺失结果 = 构建缺失探测结果(checkedAt)
    return {
      robot: {
        ...机器人,
        serverUrl: null,
      },
      checkedAt,
      server: 缺失结果,
      runtime: 缺失结果,
      telemetry: 缺失结果,
      workstationWebsocket,
    }
  }

  const baseUrl = serverUrl.replace(/\/$/, '')
  const [server, runtime, telemetry] = await Promise.all([
    探测Json接口(`${baseUrl}/api/v1/system/info`, {
      成功消息: 'robot-server 可达',
      无效响应消息: 'robot-server 返回格式不符合预期',
      响应有效: (payload) => payload.success === true,
    }),
    探测Json接口(`${baseUrl}/api/v1/runtime/ping`, {
      成功消息: '运行时探活可用',
      无效响应消息: 'runtime/ping 返回格式不符合预期',
      响应有效: (payload) => payload.success === true && 是对象(payload.data),
    }),
    探测Json接口(`${baseUrl}/api/v1/telemetry/full`, {
      成功消息: '完整遥测可用',
      无效响应消息: 'telemetry/full 返回格式不符合预期',
      响应有效: (payload) => payload.success === true && 是对象(payload.data),
    }),
  ])

  return {
    robot: {
      ...机器人,
      serverUrl,
    },
    checkedAt,
    server,
    runtime,
    telemetry,
    workstationWebsocket,
  }
}

function 构建工作站通道诊断结果(已连接: boolean, checkedAt: string): 工作站通道诊断结果 {
  return {
    status: 已连接 ? 'connected' : 'disconnected',
    connected: 已连接,
    message: 已连接 ? '工作站已收到 robot-agent 业务连接' : '工作站尚未收到 robot-agent 业务连接',
    checkedAt,
  }
}

function 构建缺失探测结果(checkedAt: string): 机器人探测结果 {
  return {
    status: 'missing',
    message: '未配置 robot-server 地址',
    url: null,
    httpStatus: null,
    durationMs: null,
    checkedAt,
  }
}

async function 探测Json接口(url: string, 选项: 接口探测选项): Promise<机器人探测结果> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 探测超时时间毫秒)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    const checkedAt = new Date().toISOString()
    const durationMs = Date.now() - startedAt
    const payload = await 安全解析Json(response)

    if (!response.ok) {
      return {
        status: 'error',
        message: 读取响应错误消息(payload) || `请求失败 (${response.status})`,
        url,
        httpStatus: response.status,
        durationMs,
        checkedAt,
      }
    }

    if (!是对象(payload) || !选项.响应有效(payload)) {
      return {
        status: 'invalid',
        message: 选项.无效响应消息,
        url,
        httpStatus: response.status,
        durationMs,
        checkedAt,
      }
    }

    return {
      status: 'ok',
      message: 选项.成功消息,
      url,
      httpStatus: response.status,
      durationMs,
      checkedAt,
    }
  } catch (error) {
    const checkedAt = new Date().toISOString()
    const durationMs = Date.now() - startedAt
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 'timeout',
        message: '请求超时',
        url,
        httpStatus: null,
        durationMs,
        checkedAt,
      }
    }

    const causeCode = 读取错误码(error)
    if (causeCode === 'ECONNREFUSED') {
      return {
        status: 'refused',
        message: '连接被拒绝',
        url,
        httpStatus: null,
        durationMs,
        checkedAt,
      }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : '请求失败',
      url,
      httpStatus: null,
      durationMs,
      checkedAt,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function 规范化机器人服务地址(机器人: RobotRecord): string | null {
  if (机器人.serverUrl && 机器人.serverUrl.trim().length > 0) {
    return 机器人.serverUrl.trim()
  }
  if (机器人.ip.trim().length > 0) {
    return `http://${机器人.ip}:8080`
  }
  return null
}

function 读取错误码(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const cause = 'cause' in error ? error.cause : undefined
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return cause.code
  }
  if ('code' in error && typeof error.code === 'string') {
    return error.code
  }
  return null
}

async function 安全解析Json(response: { json(): Promise<unknown> }): Promise<Record<string, unknown> | null> {
  try {
    const payload = await response.json() as unknown
    return 是对象(payload) ? payload : null
  } catch {
    return null
  }
}

function 读取响应错误消息(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null
  }
  if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error
  }
  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message
  }
  const detail = 是对象(payload.detail) ? payload.detail : null
  if (detail && typeof detail.error === 'string' && detail.error.trim().length > 0) {
    return detail.error
  }
  if (detail && typeof detail.message === 'string' && detail.message.trim().length > 0) {
    return detail.message
  }
  return null
}

function 是对象(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
