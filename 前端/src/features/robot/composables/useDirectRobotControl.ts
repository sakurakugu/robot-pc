import { ref, watch, type Ref } from 'vue'

const DIRECT_CONTROL_PORT = 8082
const RECONNECT_DELAY_MS = 3000

export type DirectControlMode = 'move' | 'pose' | 'two_leg'
export type DirectControlCommand = {
  command: string
  [key: string]: unknown
}

export type PhotoResponseHandler = (base64: string, format: string) => void
export type SdkModeResponseHandler = (success: boolean, sdkMode?: boolean, error?: string) => void

export function useDirectRobotControl(robotIp: Ref<string | null | undefined>) {
  const socketRef = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const lastError = ref<string | null>(null)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false
  let photoResponseHandler: PhotoResponseHandler | null = null
  let sdkModeResponseHandler: SdkModeResponseHandler | null = null

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function closeSocket(): void {
    if (socketRef.value) {
      socketRef.value.onclose = null
      socketRef.value.close()
      socketRef.value = null
    }
    isConnected.value = false
  }

  function connect(): void {
    const ip = robotIp.value?.trim()
    if (!ip || destroyed) {
      return
    }

    clearReconnectTimer()
    closeSocket()

    const socket = new WebSocket(`ws://${ip}:${DIRECT_CONTROL_PORT}`)
    socketRef.value = socket

    socket.onopen = () => {
      lastError.value = null
      isConnected.value = true
    }

    socket.onmessage = (event) => {
      handleMessage(event.data)
    }

    socket.onerror = () => {
      lastError.value = '直连控制通道异常'
    }

    socket.onclose = () => {
      if (socketRef.value === socket) {
        socketRef.value = null
      }
      isConnected.value = false
      if (!destroyed && robotIp.value?.trim()) {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }
  }

  function handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      return
    }

    try {
      const message = JSON.parse(raw) as { type?: string; data?: Record<string, unknown> }
      const data = message.data || {}

      if (message.type === 'camera_capture_response') {
        if (data.success && typeof data.image === 'string') {
          photoResponseHandler?.(data.image, typeof data.format === 'string' ? data.format : 'jpeg')
        }
        return
      }

      if (message.type === 'sdk_mode_response') {
        sdkModeResponseHandler?.(
          Boolean(data.success),
          typeof data.sdkMode === 'boolean' ? data.sdkMode : undefined,
          typeof data.error === 'string' ? data.error : undefined,
        )
      }
    } catch {
      // 本体直连服务可能返回非 JSON 调试信息，直接忽略。
    }
  }

  function sendCommand(command: DirectControlCommand): void {
    if (socketRef.value?.readyState !== WebSocket.OPEN) {
      return
    }
    socketRef.value.send(JSON.stringify({
      type: 'device_command',
      data: command,
    }))
  }

  function sendMicControl(enabled: boolean): void {
    sendCommand({ command: 'mic_control', enabled })
  }

  function sendSwitchMode(mode: DirectControlMode): void {
    sendCommand({ command: 'switch_control_mode', mode })
  }

  function sendSdkMode(enabled: boolean): void {
    sendCommand({ command: 'sdk_mode', enabled, requestId: `sdk_${Date.now()}` })
  }

  function sendCameraCapture(): void {
    sendCommand({ command: 'camera_capture', requestId: `cap_${Date.now()}` })
  }

  function setOnPhotoReceived(handler: PhotoResponseHandler | null): void {
    photoResponseHandler = handler
  }

  function setOnSdkModeResponse(handler: SdkModeResponseHandler | null): void {
    sdkModeResponseHandler = handler
  }

  watch(
    () => robotIp.value,
    () => {
      destroyed = false
      connect()
    },
    { immediate: true },
  )

  function disconnect(): void {
    destroyed = true
    clearReconnectTimer()
    closeSocket()
  }

  return {
    isConnected,
    lastError,
    connect,
    disconnect,
    sendCommand,
    sendMicControl,
    sendSwitchMode,
    sendSdkMode,
    sendCameraCapture,
    setOnPhotoReceived,
    setOnSdkModeResponse,
  }
}
