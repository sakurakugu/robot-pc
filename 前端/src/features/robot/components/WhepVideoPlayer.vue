<template>
  <div class="whep-player">
    <video
      ref="videoRef"
      class="whep-player__video"
      autoplay
      muted
      playsinline
    />

    <div
      v-if="state !== 'playing'"
      class="whep-player__overlay"
    >
      <p class="whep-player__title">
        {{ state === 'connecting' ? '正在建立本地 WebRTC 连接...' : '本地视频连接失败' }}
      </p>
      <p
        v-if="errorMsg"
        class="whep-player__detail whep-player__detail--error"
      >
        {{ errorMsg }}
      </p>
      <p class="whep-player__detail">
        {{ resolvedWhepUrl }}
      </p>
      <el-button
        v-if="state === 'error'"
        size="small"
        text
        @click="retry"
      >
        重新连接
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type PlayerState = 'connecting' | 'playing' | 'error'
type IceServerConfig = {
  urls: string | string[]
  username?: string
  credential?: string
}

const props = defineProps<{
  whepUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const state = ref<PlayerState>('connecting')
const errorMsg = ref('')
const retryKey = ref(0)

const resolvedWhepUrl = computed(() => new URL(props.whepUrl, window.location.origin).toString())

let peerConnection: RTCPeerConnection | null = null
let remoteStream: MediaStream | null = null
let sessionUrl: string | null = null

async function cleanupSession(): Promise<void> {
  const currentSessionUrl = sessionUrl
  sessionUrl = null

  if (peerConnection) {
    peerConnection.ontrack = null
    peerConnection.oniceconnectionstatechange = null
    peerConnection.onconnectionstatechange = null
    peerConnection.close()
    peerConnection = null
  }

  remoteStream = null
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }

  if (currentSessionUrl) {
    try {
      await fetch(currentSessionUrl, { method: 'DELETE' })
    } catch {
      // 会话释放失败不影响页面退出。
    }
  }
}

async function connect(): Promise<void> {
  await cleanupSession()
  state.value = 'connecting'
  errorMsg.value = ''

  try {
    const pc = new RTCPeerConnection({
      iceServers: await loadIceServers(resolvedWhepUrl.value),
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    })

    peerConnection = pc
    remoteStream = new MediaStream()

    pc.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream()
      }
      for (const track of event.streams[0]?.getTracks() || [event.track]) {
        if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
          remoteStream.addTrack(track)
        }
      }
      if (videoRef.value) {
        videoRef.value.srcObject = remoteStream
        void videoRef.value.play().catch(() => undefined)
      }
      state.value = 'playing'
    }

    pc.oniceconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
        setPlayerError(`ICE 连接已断开（${pc.iceConnectionState}）`)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setPlayerError('WebRTC 连接建立失败')
      }
    }

    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceGathering(pc, 5000)

    const localSdp = pc.localDescription?.sdp
    if (!localSdp) {
      throw new Error('无法获取本地 SDP')
    }

    const response = await fetch(resolvedWhepUrl.value, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: localSdp,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`WHEP 握手失败: HTTP ${response.status}${body ? ` - ${body}` : ''}`)
    }

    const locationHeader = response.headers.get('Location')
    if (locationHeader) {
      sessionUrl = new URL(locationHeader, resolvedWhepUrl.value).toString()
    }

    await pc.setRemoteDescription({
      type: 'answer',
      sdp: await response.text(),
    })
  } catch (error) {
    setPlayerError(error instanceof Error ? error.message : '未知错误')
    await cleanupSession()
  }
}

function setPlayerError(message: string): void {
  state.value = 'error'
  errorMsg.value = message
}

function retry(): void {
  retryKey.value += 1
}

watch(
  () => [resolvedWhepUrl.value, retryKey.value],
  () => {
    void connect()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  void cleanupSession()
})

async function loadIceServers(whepUrl: string): Promise<IceServerConfig[]> {
  try {
    const response = await fetch(whepUrl, { method: 'OPTIONS' })
    return parseIceServers(response.headers.get('Link') || '')
  } catch {
    return []
  }
}

function parseIceServers(linkHeader: string): IceServerConfig[] {
  if (!linkHeader.trim()) {
    return []
  }

  return linkHeader
    .split(/,(?=\s*<)/)
    .map((item) => item.trim())
    .map((item) => {
      const urlMatch = item.match(/<([^>]+)>/)
      const relMatch = item.match(/;\s*rel="?([^";]+)"?/)
      if (!urlMatch || relMatch?.[1] !== 'ice-server') {
        return null
      }

      const usernameMatch = item.match(/;\s*username="([^"]+)"/)
      const credentialMatch = item.match(/;\s*credential="([^"]+)"/)
      const iceServer: IceServerConfig = { urls: urlMatch[1] }
      if (usernameMatch?.[1]) {
        iceServer.username = usernameMatch[1]
      }
      if (credentialMatch?.[1]) {
        iceServer.credential = credentialMatch[1]
      }
      return iceServer
    })
    .filter((item): item is IceServerConfig => item !== null)
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve()
      return
    }

    const timer = window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', handleStateChange)
      resolve()
    }, timeoutMs)

    function handleStateChange(): void {
      if (pc.iceGatheringState !== 'complete') {
        return
      }
      window.clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', handleStateChange)
      resolve()
    }

    pc.addEventListener('icegatheringstatechange', handleStateChange)
  })
}
</script>

<style scoped>
.whep-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}

.whep-player__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.whep-player__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: #dce7ff;
  background: rgba(0, 0, 0, 0.38);
}

.whep-player__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.whep-player__detail {
  margin: 0;
  color: #8fa2c7;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}

.whep-player__detail--error {
  color: #ff9c9c;
}
</style>
