import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import type { ServerMessage } from '../../shared/types'

type Channel = 'business' | 'control' | 'audio_upload' | 'audio_download'

export class StudioWebSocketHost {
  private readonly clients = new Set<import('ws').WebSocket>()
  private socketServer: WebSocketServer | null = null

  初始化(httpServer: Server): void {
    this.socketServer = new WebSocketServer({
      server: httpServer,
      path: '/api/v1/web/business',
    })

    this.socketServer.on('connection', (socket) => {
      this.clients.add(socket)
      socket.on('close', () => {
        this.clients.delete(socket)
      })
    })
  }

  sendToRobot(_robotId: string, _message: ServerMessage, _channel: Channel = 'business'): boolean {
    return false
  }

  broadcast(message: ServerMessage, _channel: Channel = 'business'): void {
    const payload = JSON.stringify(message)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }
}
