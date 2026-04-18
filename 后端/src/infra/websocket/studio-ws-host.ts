import type { IncomingMessage, Server } from 'node:http'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import type { ServerMessage, StudioSocketMessageContext } from '../../shared/types'

type Channel = 'business' | 'control' | 'audio_upload' | 'audio_download'
type MessageListener = (message: ServerMessage, context: StudioSocketMessageContext) => void
type ConnectionListener = (context: StudioSocketMessageContext & { connected: boolean }) => void

export class StudioWebSocketHost {
  private readonly uiClients = new Set<import('ws').WebSocket>()
  private readonly robotClients = new Map<string, import('ws').WebSocket>()
  private readonly messageListeners = new Set<MessageListener>()
  private readonly connectionListeners = new Set<ConnectionListener>()
  private socketServer: WebSocketServer | null = null

  初始化(httpServer: Server): void {
    this.socketServer = new WebSocketServer({
      server: httpServer,
      path: '/api/v1/web/business',
    })

    this.socketServer.on('connection', (socket, request) => {
      const context = this.解析连接上下文(request)

      if (context.role === 'robot' && context.robotId) {
        const oldSocket = this.robotClients.get(context.robotId)
        oldSocket?.close()
        this.robotClients.set(context.robotId, socket)
      } else {
        this.uiClients.add(socket)
      }

      this.广播连接变化({ ...context, connected: true })

      socket.on('message', (raw) => {
        this.处理收到的消息(raw, context)
      })

      socket.on('close', () => {
        if (context.role === 'robot' && context.robotId) {
          if (this.robotClients.get(context.robotId) === socket) {
            this.robotClients.delete(context.robotId)
          }
        } else {
          this.uiClients.delete(socket)
        }
        this.广播连接变化({ ...context, connected: false })
      })
    })
  }

  sendToRobot(robotId: string, message: ServerMessage, _channel: Channel = 'business'): boolean {
    const socket = this.robotClients.get(robotId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false
    }
    socket.send(JSON.stringify(message))
    return true
  }

  broadcast(message: ServerMessage, _channel: Channel = 'business'): void {
    const payload = JSON.stringify(message)
    for (const client of this.uiClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }

  isRobotConnected(robotId: string): boolean {
    const socket = this.robotClients.get(robotId)
    return !!socket && socket.readyState === WebSocket.OPEN
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener)
    return () => {
      this.connectionListeners.delete(listener)
    }
  }

  private 处理收到的消息(raw: RawData, context: StudioSocketMessageContext): void {
    try {
      const message = JSON.parse(raw.toString()) as ServerMessage
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return
      }
      this.messageListeners.forEach((listener) => listener(message, context))
    } catch {
      return
    }
  }

  private 解析连接上下文(request: IncomingMessage): StudioSocketMessageContext {
    const url = new URL(request.url || '/api/v1/web/business', 'http://127.0.0.1')
    const role = url.searchParams.get('role') === 'robot' ? 'robot' : 'ui'
    const robotId = url.searchParams.get('robotId')?.trim() || undefined
    return { role, robotId }
  }

  private 广播连接变化(context: StudioSocketMessageContext & { connected: boolean }): void {
    this.connectionListeners.forEach((listener) => listener(context))
  }
}
