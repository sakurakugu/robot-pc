import { ref } from 'vue'

type MessageHandler = (data: unknown) => void

const socketRef = ref<WebSocket | null>(null)
const isConnected = ref(false)
const handlers: MessageHandler[] = []

function dispatchMessage(data: unknown): void {
  handlers.slice().forEach((handler) => handler(data))
}

function 构造地址(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/web/business`
}

export function useWebSocket() {
  const onMessage = (handler: MessageHandler) => {
    if (!handlers.includes(handler)) {
      handlers.push(handler)
    }

    return () => {
      const index = handlers.indexOf(handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  const connect = async (): Promise<void> => {
    if (socketRef.value && isConnected.value) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(构造地址())
      const timeout = window.setTimeout(() => {
        socket.close()
        reject(new Error('工作站 WebSocket 连接超时'))
      }, 3000)

      socket.onopen = () => {
        window.clearTimeout(timeout)
        socketRef.value = socket
        isConnected.value = true
        resolve()
      }

      socket.onmessage = (event) => {
        try {
          dispatchMessage(JSON.parse(event.data))
        } catch {
          dispatchMessage(event.data)
        }
      }

      socket.onerror = () => {
        window.clearTimeout(timeout)
      }

      socket.onclose = () => {
        window.clearTimeout(timeout)
        isConnected.value = false
        if (socketRef.value === socket) {
          socketRef.value = null
        }
      }
    })
  }

  const disconnect = (): void => {
    socketRef.value?.close()
    socketRef.value = null
    isConnected.value = false
  }

  return {
    isConnected,
    connect,
    disconnect,
    onMessage,
  }
}
