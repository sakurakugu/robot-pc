<template>
  <div class="robot-operation">
    <div class="top-bar">
      <div class="left-tools">
        <el-button
          link
          @click="router.push('/robots')"
        >
          <el-icon :size="20">
            <Back />
          </el-icon>
        </el-button>

        <el-divider direction="vertical" />

        <el-select
          v-model="selectedUuid"
          placeholder="选择机器狗"
          class="robot-select"
          size="small"
          filterable
        >
          <el-option
            v-for="robot in robots"
            :key="robot.uuid"
            :label="robot.name || robot.uuid"
            :value="robot.uuid"
          />
        </el-select>

        <el-tag
          size="small"
          :type="directControl.isConnected.value ? 'success' : 'warning'"
        >
          {{ directControl.isConnected.value ? '直连已接入' : '直连未接入' }}
        </el-tag>

        <el-divider direction="vertical" />

        <el-switch
          v-model="controlMode"
          active-text="姿态"
          inactive-text="移动"
          active-value="pose"
          inactive-value="move"
          inline-prompt
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #409eff"
          @change="handleControlModeChange"
        />

        <el-divider direction="vertical" />

        <el-switch
          v-model="sdkMode"
          active-text="SDK"
          inactive-text="遥控"
          inline-prompt
          :loading="sdkModeLoading"
          @change="handleSdkModeChange"
        />

        <el-divider direction="vertical" />

        <el-popover
          placement="bottom"
          :width="220"
          trigger="click"
        >
          <template #reference>
            <el-button
              size="small"
              text
            >
              速度: {{ speed }}
            </el-button>
          </template>
          <div class="speed-popover">
            <span>速度</span>
            <el-slider
              v-model="speed"
              :min="1"
              :max="30"
              size="small"
            />
          </div>
        </el-popover>

        <el-divider direction="vertical" />

        <el-switch
          v-model="showVideo"
          active-text="视频"
          inline-prompt
        />

        <el-divider direction="vertical" />

        <el-button
          size="small"
          :loading="isCapturing"
          :icon="Camera"
          @click="handleCapturePhoto"
        >
          拍照
        </el-button>

        <el-button
          type="danger"
          size="small"
          :icon="SwitchButton"
          @click="handleEmergencyStop"
        >
          急停
        </el-button>

        <el-tooltip :content="micEnabled ? '关闭机器狗麦克风' : '开启机器狗麦克风'">
          <el-button
            size="small"
            :type="micEnabled ? '' : 'danger'"
            circle
            @click="handleToggleMic"
          >
            <el-icon>
              <Microphone />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <div class="right-info">
        <div class="info-item">
          <el-icon><Connection /></el-icon>
          <span>{{ telemetry?.online ? '本体在线' : '本体离线' }}</span>
        </div>
        <div class="info-item">
          <el-icon><Bot /></el-icon>
          <span>{{ robotBatteryText }}</span>
        </div>
        <div class="info-item">
          <span>{{ currentTime }}</span>
        </div>
      </div>
    </div>

    <div class="video-area">
      <WhepVideoPlayer
        v-if="showVideo && activeWhepUrl"
        :key="activeWhepUrl"
        :whep-url="activeWhepUrl"
      />

      <div
        v-else
        class="video-placeholder"
      >
        <el-icon
          :size="64"
          color="#8fa2c7"
        >
          <VideoCamera />
        </el-icon>
        <p>{{ videoPlaceholderText }}</p>
        <p
          v-if="selectedRobot"
          class="video-detail"
        >
          {{ selectedRobot.ip ? `WHEP: http://${selectedRobot.ip}:8889/test/whep` : '当前机器狗缺少 IP，无法直连视频。' }}
        </p>
      </div>

      <div class="floating-layer">
        <div class="floating-item chat-placeholder">
          <el-tooltip content="聊天抽屉将在第二阶段接入">
            <el-button
              class="glass-button"
              circle
              disabled
            >
              <el-icon><ChatLineSquare /></el-icon>
            </el-button>
          </el-tooltip>
        </div>

        <div class="floating-item left-joystick">
          <JoystickPad
            class="joystick-pad"
            :class="{ 'is-disabled': controlMode === 'pose' && !twoLegStandActive }"
            :strict-circle-hit="true"
            @change="onMoveJoystick"
            @end="onMoveJoystickEnd"
          />
        </div>

        <div
          v-for="button in actionButtons"
          :key="button.id"
          class="floating-item action-item"
          :style="{ left: `${button.x}%`, top: `${button.y}%` }"
        >
          <ActionButton
            :label="button.label"
            :title="button.title"
            :disabled="!directControl.isConnected.value"
            @click="handleActionPress(button)"
          />
        </div>

        <div class="floating-item right-joystick">
          <JoystickPad
            class="joystick-pad"
            :class="{ 'is-disabled': rightJoystickDisabled }"
            :strict-circle-hit="true"
            @change="onLookJoystick"
            @end="onLookJoystickEnd"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionButton from '@/features/robot/components/ActionButton.vue'
import WhepVideoPlayer from '@/features/robot/components/WhepVideoPlayer.vue'
import { getRobotList, getRobotTelemetry } from '@/features/robot/api'
import { useDirectRobotControl } from '@/features/robot/composables/useDirectRobotControl'
import { useRobotOperationJoystick } from '@/features/robot/composables/useRobotOperationJoystick'
import type { Robot, RobotTelemetry } from '@/features/robot/types'
import JoystickPad from '@/share/components/JoystickPad.vue'
import {
  Back,
  Camera,
  ChatLineSquare,
  Connection,
  Microphone,
  SwitchButton,
  VideoCamera,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type ActionButtonConfig = {
  id: string
  label: string
  title: string
  x: number
  y: number
}

const route = useRoute()
const router = useRouter()

const robots = ref<Robot[]>([])
const selectedUuid = ref('')
const showVideo = ref(true)
const sdkMode = ref(true)
const sdkModeLoading = ref(false)
const micEnabled = ref(true)
const isCapturing = ref(false)
const currentTime = ref('')
const telemetry = ref<RobotTelemetry | null>(null)

let timeTimer: ReturnType<typeof setInterval> | null = null
let telemetryTimer: ReturnType<typeof setInterval> | null = null
let sdkModeTimer: ReturnType<typeof setTimeout> | null = null
let lastEstopPressAt = 0

const actionButtons: ActionButtonConfig[] = [
  { id: 'stand_up', label: '起立', title: '起立', x: 34, y: 78 },
  { id: 'sit_down', label: '趴下', title: '趴下', x: 44, y: 78 },
  { id: 'front_jump', label: '前跳', title: '向前跳', x: 54, y: 78 },
  { id: 'jump', label: '上跳', title: '向上跳', x: 64, y: 78 },
  { id: 'back_flip', label: '后翻', title: '后空翻', x: 36, y: 88 },
  { id: 'two_leg_stand', label: '双腿', title: '双腿站立', x: 50, y: 88 },
  { id: 'shake_hand', label: '招手', title: '打招呼', x: 64, y: 88 },
]

const selectedRobot = computed(() => robots.value.find((item) => item.uuid === selectedUuid.value) || null)
const selectedRobotIp = computed(() => selectedRobot.value?.ip || null)
const activeWhepUrl = computed(() => selectedRobotIp.value ? `http://${selectedRobotIp.value}:8889/test/whep` : '')
const robotBatteryText = computed(() => {
  if (typeof telemetry.value?.power === 'number') {
    return `${Math.round(telemetry.value.power)}%`
  }
  return '--'
})
const videoPlaceholderText = computed(() => {
  if (!selectedRobot.value) {
    return '请先选择机器狗'
  }
  if (!showVideo.value) {
    return '视频已关闭'
  }
  if (!selectedRobot.value.ip) {
    return '当前机器狗缺少 IP，无法直连视频'
  }
  return '等待视频连接'
})

const directControl = useDirectRobotControl(selectedRobotIp)
const {
  controlMode,
  speed,
  twoLegStandActive,
  rightJoystickDisabled,
  onMoveJoystick,
  onLookJoystick,
  onMoveJoystickEnd,
  onLookJoystickEnd,
} = useRobotOperationJoystick({
  isConnected: directControl.isConnected,
  sendCommand: directControl.sendCommand,
})

async function loadRobots(): Promise<void> {
  const response = await getRobotList()
  robots.value = response.data.robots

  const routeUuid = typeof route.params.uuid === 'string' ? route.params.uuid : ''
  if (routeUuid && robots.value.some((item) => item.uuid === routeUuid)) {
    selectedUuid.value = routeUuid
    return
  }

  if (!selectedUuid.value && robots.value.length > 0) {
    selectedUuid.value = robots.value[0].uuid
  }
}

function updateTime(): void {
  currentTime.value = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

async function refreshTelemetry(): Promise<void> {
  if (!selectedUuid.value) {
    telemetry.value = null
    return
  }

  try {
    const response = await getRobotTelemetry(selectedUuid.value)
    telemetry.value = response.data.telemetry
  } catch {
    telemetry.value = telemetry.value ? { ...telemetry.value, online: false } : null
  }
}

function restartTelemetryPolling(): void {
  if (telemetryTimer !== null) {
    clearInterval(telemetryTimer)
  }
  void refreshTelemetry()
  telemetryTimer = setInterval(() => {
    void refreshTelemetry()
  }, 3000)
}

function handleControlModeChange(): void {
  if (twoLegStandActive.value) {
    twoLegStandActive.value = false
    directControl.sendAction('cancel_two_leg_stand')
  }
  directControl.sendSwitchMode(controlMode.value)
}

function clearSdkModeTimer(): void {
  if (sdkModeTimer !== null) {
    clearTimeout(sdkModeTimer)
    sdkModeTimer = null
  }
}

function handleSdkModeChange(value: string | number | boolean): void {
  clearSdkModeTimer()
  sdkModeLoading.value = true
  directControl.sendSdkMode(Boolean(value))
  sdkModeTimer = setTimeout(() => {
    sdkModeLoading.value = false
    ElMessage.warning('SDK 模式切换超时，请确认本体直连服务状态')
  }, 30000)
}

function handleCapturePhoto(): void {
  if (!selectedRobotIp.value) {
    ElMessage.warning('当前机器狗缺少 IP，无法拍照')
    return
  }
  if (!directControl.isConnected.value) {
    ElMessage.warning('直连控制通道未接入')
    return
  }
  isCapturing.value = true
  directControl.sendCameraCapture()
}

function handleEmergencyStop(): void {
  const now = Date.now()
  if (now - lastEstopPressAt < 5000) {
    directControl.sendEstop()
    ElMessage.error('已触发急停')
    lastEstopPressAt = 0
    return
  }
  lastEstopPressAt = now
  ElMessage.warning('再次点击确认急停（5 秒内）')
}

function handleToggleMic(): void {
  micEnabled.value = !micEnabled.value
  directControl.sendMicControl(micEnabled.value)
  ElMessage.success(micEnabled.value ? '机器狗麦克风已开启' : '机器狗麦克风已关闭')
}

function handleActionPress(button: ActionButtonConfig): void {
  if (button.id === 'two_leg_stand') {
    twoLegStandActive.value = !twoLegStandActive.value
    directControl.sendAction(twoLegStandActive.value ? 'two_leg_stand' : 'cancel_two_leg_stand')
    ElMessage.success(twoLegStandActive.value ? '进入双腿站立' : '退出双腿站立')
    return
  }

  directControl.sendAction(button.id)
  ElMessage.success(`已发送动作：${button.title}`)
}

directControl.setOnPhotoReceived((base64, format) => {
  isCapturing.value = false
  const link = document.createElement('a')
  link.href = `data:image/${format};base64,${base64}`
  link.download = `robot_photo_${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`
  link.click()
  ElMessage.success('照片已下载')
})

directControl.setOnSdkModeResponse((success, result, error) => {
  clearSdkModeTimer()
  sdkModeLoading.value = false
  if (success) {
    sdkMode.value = Boolean(result)
    ElMessage.success(sdkMode.value ? 'SDK 模式已开启' : '遥控模式已开启')
    return
  }
  ElMessage.error(error || 'SDK 模式切换失败')
})

watch(selectedUuid, () => {
  telemetry.value = null
  restartTelemetryPolling()
})

onMounted(async () => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  await loadRobots()
  restartTelemetryPolling()
})

onBeforeUnmount(() => {
  if (timeTimer !== null) {
    clearInterval(timeTimer)
  }
  if (telemetryTimer !== null) {
    clearInterval(telemetryTimer)
  }
  clearSdkModeTimer()
  directControl.setOnPhotoReceived(null)
  directControl.setOnSdkModeResponse(null)
  directControl.disconnect()
})
</script>

<style scoped>
.robot-operation {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #101216;
  color: #fff;
}

.top-bar {
  flex-shrink: 0;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
  background: #252932;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  z-index: 2;
}

.left-tools,
.right-info,
.info-item,
.speed-popover {
  display: flex;
  align-items: center;
  gap: 12px;
}

.left-tools {
  min-width: 0;
  flex-wrap: wrap;
}

.right-info {
  flex-shrink: 0;
  color: #d8e2f2;
  font-size: 13px;
}

.robot-select {
  width: 190px;
}

.speed-popover {
  padding: 0 8px;
}

.speed-popover :deep(.el-slider) {
  flex: 1;
}

.video-area {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgba(29, 78, 216, 0.22), transparent 30%),
    radial-gradient(circle at 78% 18%, rgba(20, 184, 166, 0.14), transparent 28%),
    #030509;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #8fa2c7;
  text-align: center;
}

.video-placeholder p {
  margin: 0;
}

.video-detail {
  max-width: 620px;
  color: #65748e;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}

.floating-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.floating-item {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

.chat-placeholder {
  left: 7%;
  top: 16%;
}

.left-joystick {
  left: 14%;
  top: 78%;
}

.right-joystick {
  left: 86%;
  top: 78%;
}

.glass-button {
  background: rgba(0, 0, 0, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: #fff;
}

.joystick-pad.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

@media (max-width: 980px) {
  .top-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .right-info {
    flex-wrap: wrap;
  }

  .left-joystick {
    left: 18%;
  }

  .right-joystick {
    left: 82%;
  }
}
</style>
