type 元数据 = Record<string, unknown> | undefined

function 输出(level: string, message: string, meta?: 元数据): void {
  const time = new Date().toISOString()
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[${time}] [${level}] ${message}`, meta)
    return
  }
  console.log(`[${time}] [${level}] ${message}`)
}

export const logger = {
  初始化: async (): Promise<void> => {},
  info: (message: string, meta?: 元数据) => 输出('信息', message, meta),
  warn: (message: string, meta?: 元数据) => 输出('警告', message, meta),
  debug: (message: string, meta?: 元数据) => 输出('调试', message, meta),
  error: (message: string, errorOrMeta?: unknown, meta?: 元数据) => {
    if (errorOrMeta instanceof Error) {
      输出('错误', message, {
        error: errorOrMeta.message,
        stack: errorOrMeta.stack,
        ...(meta || {}),
      })
      return
    }
    if (errorOrMeta && typeof errorOrMeta === 'object') {
      输出('错误', message, errorOrMeta as Record<string, unknown>)
      return
    }
    输出('错误', message)
  },
}
