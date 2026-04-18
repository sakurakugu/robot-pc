<template>
  <div class="mapping-workbench">
    <PageHeader
      title="地图工作台"
      :icon="Map"
      @back="goHome"
    >
      <template #extra>
        <div class="header-actions">
          <el-select
            v-model="selectedRobotId"
            class="robot-select"
            clearable
            filterable
            placeholder="选择机器人读取真机遥测"
          >
            <el-option
              v-for="robot in robots"
              :key="robot.uuid"
              :label="robot.name || robot.uuid"
              :value="robot.uuid"
            >
              <div class="robot-option">
                <span>{{ robot.name || robot.uuid }}</span>
                <small>{{ robot.serverUrl || robot.ip || '-' }}</small>
              </div>
            </el-option>
          </el-select>
          <el-button
            type="primary"
            :loading="loading"
            :icon="RefreshRight"
            @click="refreshAll"
          >
            刷新状态
          </el-button>
        </div>
      </template>
    </PageHeader>

    <section class="status-strip">
      <div class="status-chip">
        <span class="status-label">模式</span>
        <strong>{{ modeLabelMap[runtime.mode] }}</strong>
      </div>
      <div class="status-chip">
        <span class="status-label">地图数量</span>
        <strong>{{ maps.length }}</strong>
      </div>
      <div class="status-chip">
        <span class="status-label">活动地图</span>
        <strong>{{ activeMap?.name || '未加载' }}</strong>
      </div>
      <div class="status-chip">
        <span class="status-label">遥测来源</span>
        <strong>{{ telemetrySourceLabelMap[runtime.telemetrySource] }}</strong>
      </div>
      <div class="status-chip">
        <span class="status-label">命令来源</span>
        <strong>{{ commandSourceLabelMap[runtime.commandSource] }}</strong>
      </div>
      <div class="status-chip status-chip-wide">
        <span class="status-label">地图目录</span>
        <strong class="path-text">{{ runtime.mapDirectory || '-' }}</strong>
      </div>
    </section>

    <div class="workbench-grid">
      <aside class="panel maps-panel">
        <div class="panel-header">
          <div>
            <h2>地图仓库</h2>
            <p>自动扫描本地 `yaml + pgm/png` 地图</p>
          </div>
          <el-tag type="info">
            {{ maps.length }} 张
          </el-tag>
        </div>

        <div
          v-if="maps.length === 0"
          class="empty-state"
        >
          <el-empty description="暂无可用地图">
            <template #description>
              <div class="empty-description">
                <p>请把地图文件放到本地目录后刷新：</p>
                <code>{{ runtime.mapDirectory || '加载中...' }}</code>
              </div>
            </template>
          </el-empty>
        </div>

        <div
          v-else
          class="map-list"
        >
          <button
            v-for="item in maps"
            :key="item.id"
            type="button"
            class="map-card"
            :class="{ active: item.id === selectedMapId }"
            @click="selectedMapId = item.id"
          >
            <div class="map-card-top">
              <div>
                <strong>{{ item.name }}</strong>
                <p>{{ item.imageFormat.toUpperCase() }} / {{ item.resolution.toFixed(3) }}m</p>
              </div>
              <el-tag
                size="small"
                :type="runtime.activeMapId === item.id ? 'success' : 'info'"
              >
                {{ runtime.activeMapId === item.id ? '当前' : '待选' }}
              </el-tag>
            </div>
            <div class="map-card-meta">
              <span>原点 {{ formatOrigin(item.origin) }}</span>
              <span>更新时间 {{ formatTime(item.updatedAt) }}</span>
            </div>
          </button>
        </div>
      </aside>

      <main class="panel viewer-panel">
        <div class="panel-header">
          <div>
            <h2>地图画布</h2>
            <p>显示地图底图，并叠加机器人位姿与目标位姿</p>
          </div>
          <div class="canvas-legend">
            <span><i class="legend-dot robot" />机器人</span>
            <span><i class="legend-dot goal" />目标点</span>
          </div>
        </div>

        <div
          v-if="!selectedMap"
          class="viewer-empty"
        >
          <el-empty description="请选择左侧地图" />
        </div>

        <div
          v-else
          class="viewer-stage"
        >
          <div class="map-stage-meta">
            <span>地图文件：{{ selectedMap.yamlPath }}</span>
            <span>图片文件：{{ selectedMap.imagePath }}</span>
          </div>

          <div class="map-canvas-scroll">
            <div
              v-if="mapImageBroken"
              class="viewer-empty"
            >
              <el-result
                icon="warning"
                title="地图图片加载失败"
                sub-title="请检查地图图片路径是否存在，或确认工作站后端是否正在运行。"
              />
            </div>

            <div
              v-else
              class="map-canvas"
            >
              <img
                class="map-image"
                :src="selectedMap.imageUrl"
                :alt="selectedMap.name"
                @load="handleImageLoad"
                @error="handleImageError"
              >

              <div
                v-if="currentPoseStyle"
                class="pose-marker robot"
                :style="currentPoseStyle"
                title="机器人当前位置"
              >
                <span class="pose-arrow" />
              </div>

              <div
                v-if="goalPoseStyle"
                class="pose-marker goal"
                :style="goalPoseStyle"
                title="目标位姿"
              />
            </div>
          </div>
        </div>
      </main>

      <aside class="panel runtime-panel">
        <div class="panel-header">
          <div>
            <h2>运行与命令</h2>
            <p>第一版先提供本地桩控制按钮</p>
          </div>
        </div>

        <div class="command-grid">
          <el-button
            type="warning"
            plain
            :disabled="runtime.commandSource !== 'stub' && runtime.commandSource !== 'robot_ws'"
            @click="sendCommand('start_mapping')"
          >
            开始建图
          </el-button>
          <el-button
            type="primary"
            plain
            :disabled="!selectedMap || (runtime.commandSource !== 'stub' && runtime.commandSource !== 'robot_ws')"
            @click="sendCommand('load_map', selectedMap?.id)"
          >
            加载选中地图
          </el-button>
          <el-button
            type="success"
            plain
            :disabled="!selectedMap || (runtime.commandSource !== 'stub' && runtime.commandSource !== 'robot_ws')"
            @click="sendCommand('start_localization', selectedMap?.id)"
          >
            启动定位
          </el-button>
          <el-button
            plain
            :disabled="!runtime.localizationActive || (runtime.commandSource !== 'stub' && runtime.commandSource !== 'robot_ws')"
            @click="sendCommand('stop_localization')"
          >
            停止定位
          </el-button>
        </div>

        <div
          v-if="runtime.commandSource === 'pending_robot'"
          class="runtime-tip"
        >
          已接入真机遥测读取，地图命令直连链路尚未接入，按钮已禁用。
        </div>

        <div
          v-if="runtime.commandSource === 'robot_ws'"
          class="runtime-tip runtime-tip-success"
        >
          当前机器人已连接到工作站业务通道，地图命令将直接通过 `robot-agent` 业务 WebSocket 下发。
        </div>

        <div class="runtime-section">
          <h3>机器人遥测</h3>
          <div
            v-if="!runtime.selectedRobot"
            class="history-empty"
          >
            当前未选择机器人，页面使用工作站本地桩状态。
          </div>
          <div
            v-else
            class="robot-runtime-card"
          >
            <div class="robot-runtime-top">
              <strong>{{ runtime.selectedRobot.name }}</strong>
              <el-tag :type="runtime.selectedRobot.telemetryOnline ? 'success' : 'info'">
                {{ runtime.selectedRobot.telemetryOnline ? '遥测在线' : '遥测未知/离线' }}
              </el-tag>
            </div>
            <div class="robot-runtime-meta">
              <span>IP: {{ runtime.selectedRobot.ip }}</span>
              <span>服务: {{ runtime.selectedRobot.serverUrl || '-' }}</span>
              <span>状态: {{ runtime.selectedRobot.status }}</span>
              <span>工作站通道: {{ runtime.selectedRobot.wsConnected ? '已连接' : '未连接' }}</span>
              <span>拉取时间: {{ runtime.selectedRobot.telemetryFetchedAt ? formatTime(runtime.selectedRobot.telemetryFetchedAt) : '-' }}</span>
            </div>
            <div
              v-if="runtime.selectedRobot.telemetryError"
              class="runtime-error"
            >
              {{ runtime.selectedRobot.telemetryError }}
            </div>
            <div
              v-if="runtime.selectedRobot.telemetryAvailableTypes.length > 0"
              class="telemetry-tags"
            >
              <el-tag
                v-for="type in runtime.selectedRobot.telemetryAvailableTypes"
                :key="type"
                size="small"
                effect="plain"
              >
                {{ type }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="runtime-section">
          <h3>运行状态</h3>
          <div class="kv-list">
            <div class="kv-item">
              <span>当前模式</span>
              <strong>{{ modeLabelMap[runtime.mode] }}</strong>
            </div>
            <div class="kv-item">
              <span>建图状态</span>
              <strong>{{ runtime.mappingActive ? '进行中' : '未运行' }}</strong>
            </div>
            <div class="kv-item">
              <span>定位状态</span>
              <strong>{{ runtime.localizationActive ? '运行中' : '未运行' }}</strong>
            </div>
            <div class="kv-item">
              <span>最后命令</span>
              <strong>{{ runtime.lastCommand ? commandLabelMap[runtime.lastCommand] : '-' }}</strong>
            </div>
            <div class="kv-item">
              <span>最后时间</span>
              <strong>{{ runtime.lastCommandAt ? formatTime(runtime.lastCommandAt) : '-' }}</strong>
            </div>
          </div>
        </div>

        <div class="runtime-section">
          <h3>位姿数据</h3>
          <div class="pose-card">
            <p class="pose-title">
              机器人位姿
            </p>
            <p>{{ formatPose(runtime.currentPose) }}</p>
          </div>
          <div class="pose-card">
            <p class="pose-title">
              目标位姿
            </p>
            <p>{{ formatPose(runtime.goalPose) }}</p>
          </div>
        </div>

        <div class="runtime-section">
          <h3>命令历史</h3>
          <div
            v-if="runtime.commandHistory.length === 0"
            class="history-empty"
          >
            暂无命令记录
          </div>
          <div
            v-else
            class="history-list"
          >
            <div
              v-for="record in runtime.commandHistory"
              :key="`${record.timestamp}-${record.command}`"
              class="history-item"
            >
              <strong>{{ commandLabelMap[record.command] }}</strong>
              <span>{{ record.mapId || '无地图' }}</span>
              <time>{{ formatTime(record.timestamp) }}</time>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Map } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/share/components/PageHeader.vue'
import { mappingApi } from '../api'
import type { MappingCommand, MappingRuntime, PlanarPose, StudioMap } from '../types'
import { getRobotList } from '@/features/robot/api'
import type { Robot } from '@/features/robot/types'

const router = useRouter()
const loading = ref(false)
const maps = ref<StudioMap[]>([])
const robots = ref<Robot[]>([])
const selectedRobotId = ref('')
const selectedMapId = ref<string>('')
const mapImageSize = ref({ width: 0, height: 0 })
const mapImageBroken = ref(false)
const runtime = ref<MappingRuntime>({
  mode: 'idle',
  activeMapId: null,
  mappingActive: false,
  localizationActive: false,
  currentPose: null,
  goalPose: null,
  lastCommand: null,
  lastCommandAt: null,
  commandHistory: [],
  availableMapCount: 0,
  mapDirectory: '',
  telemetrySource: 'stub',
  commandSource: 'stub',
  selectedRobot: null,
})

const modeLabelMap: Record<MappingRuntime['mode'], string> = {
  idle: '空闲',
  mapping: '建图中',
  map_loaded: '地图已加载',
  localizing: '定位中',
}

const commandLabelMap: Record<MappingCommand, string> = {
  start_mapping: '开始建图',
  load_map: '加载地图',
  start_localization: '启动定位',
  stop_localization: '停止定位',
}

const telemetrySourceLabelMap: Record<MappingRuntime['telemetrySource'], string> = {
  stub: '工作站本地桩',
  robot: '真机 robot-server',
}

const commandSourceLabelMap: Record<MappingRuntime['commandSource'], string> = {
  stub: '工作站本地桩',
  robot_ws: '工作站直连 robot-agent',
  pending_robot: '真机命令待接入',
}

const selectedMap = computed(() => maps.value.find((item) => item.id === selectedMapId.value) || null)
const activeMap = computed(() => maps.value.find((item) => item.id === runtime.value.activeMapId) || null)

const currentPoseStyle = computed(() => buildPoseStyle(runtime.value.currentPose, true))
const goalPoseStyle = computed(() => buildPoseStyle(runtime.value.goalPose, false))

let pollTimer: number | null = null

async function refreshAll(): Promise<void> {
  loading.value = true
  try {
    const [mapsResponse, runtimeResponse, robotResponse] = await Promise.all([
      mappingApi.getMaps(),
      mappingApi.getRuntime(selectedRobotId.value || undefined),
      getRobotList(),
    ])

    maps.value = mapsResponse.data.maps
    runtime.value = runtimeResponse.data
    robots.value = robotResponse.data.robots

    if (runtime.value.activeMapId && maps.value.some((item) => item.id === runtime.value.activeMapId)) {
      selectedMapId.value = runtime.value.activeMapId
    } else if (!maps.value.some((item) => item.id === selectedMapId.value)) {
      selectedMapId.value = maps.value[0]?.id || ''
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function sendCommand(command: MappingCommand, mapId?: string): Promise<void> {
  try {
    const response = await mappingApi.sendCommand(command, mapId, selectedRobotId.value || undefined)
    runtime.value = response.data
    if (response.data.activeMapId) {
      selectedMapId.value = response.data.activeMapId
    }
    ElMessage.success(response.message || '命令已发送')
  } catch (error) {
    console.error(error)
  }
}

function goHome(): void {
  router.push('/')
}

function handleImageLoad(event: Event): void {
  mapImageBroken.value = false
  const target = event.target as HTMLImageElement
  mapImageSize.value = {
    width: target.naturalWidth,
    height: target.naturalHeight,
  }
}

function handleImageError(): void {
  mapImageBroken.value = true
  mapImageSize.value = { width: 0, height: 0 }
}

function buildPoseStyle(pose: PlanarPose | null, withArrow: boolean): Record<string, string> | null {
  if (!pose || !selectedMap.value || mapImageSize.value.width <= 0 || mapImageSize.value.height <= 0) {
    return null
  }

  const xPixels = (pose.position[0] - selectedMap.value.origin[0]) / selectedMap.value.resolution
  const yPixels = mapImageSize.value.height - ((pose.position[1] - selectedMap.value.origin[1]) / selectedMap.value.resolution)

  const left = (xPixels / mapImageSize.value.width) * 100
  const top = (yPixels / mapImageSize.value.height) * 100

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null
  }

  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: withArrow
      ? `translate(-50%, -50%) rotate(${pose.yaw}rad)`
      : 'translate(-50%, -50%)',
  }
}

function formatOrigin(origin: [number, number, number]): string {
  return `[${origin.map((item) => item.toFixed(2)).join(', ')}]`
}

function formatPose(pose: PlanarPose | null): string {
  if (!pose) {
    return '暂无数据'
  }

  const [x, y] = pose.position
  return `x=${x.toFixed(3)}m, y=${y.toFixed(3)}m, yaw=${pose.yaw.toFixed(3)}rad, 置信度=${pose.confidence.toFixed(2)}`
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

onMounted(async () => {
  await refreshAll()
  pollTimer = window.setInterval(() => {
    void refreshAll()
  }, 5000)
})

watch(selectedMapId, () => {
  mapImageBroken.value = false
  mapImageSize.value = { width: 0, height: 0 }
})

watch(selectedRobotId, async () => {
  await refreshAll()
})

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
  }
})
</script>

<style scoped>
.mapping-workbench {
  min-height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  color: var(--studio-text-primary);
}

.panel,
.status-chip {
  border: 1px solid var(--studio-border);
  background: var(--studio-panel-background);
  box-shadow: var(--studio-shadow);
  backdrop-filter: blur(14px);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.robot-select {
  width: 280px;
}

.robot-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.robot-option small {
  color: var(--studio-text-muted);
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.status-chip {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 20px;
  border-radius: 20px;
}

.status-label {
  font-size: 12px;
  color: var(--studio-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.path-text {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
}

.status-chip-wide {
  grid-column: span 2;
}

.workbench-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 360px;
  gap: 18px;
  margin-top: 18px;
}

.panel {
  border-radius: 28px;
  padding: 22px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
}

.panel-header p {
  margin: 8px 0 0;
  color: var(--studio-text-muted);
  line-height: 1.5;
}

.map-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 310px);
  overflow: auto;
}

.map-card {
  width: 100%;
  padding: 16px;
  border: 1px solid var(--studio-border);
  border-radius: 20px;
  background: var(--studio-card-background);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.map-card:hover,
.map-card.active {
  transform: translateY(-2px);
  border-color: var(--studio-border-strong);
  box-shadow: var(--studio-shadow-strong);
}

.map-card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.map-card-top strong {
  display: block;
  font-size: 16px;
}

.map-card-top p,
.map-card-meta {
  margin: 6px 0 0;
  color: var(--studio-text-muted);
}

.map-card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
}

.empty-state,
.viewer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

.empty-description {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.empty-description p {
  margin: 0;
}

.empty-description code {
  max-width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--studio-code-background);
  color: var(--studio-code-text);
  word-break: break-all;
}

.viewer-panel {
  display: flex;
  flex-direction: column;
}

.canvas-legend {
  display: flex;
  gap: 14px;
  color: var(--studio-text-secondary);
  font-size: 13px;
}

.canvas-legend span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.legend-dot.robot {
  background: #38bdf8;
}

.legend-dot.goal {
  background: #f97316;
}

.map-stage-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  color: var(--studio-text-muted);
  font-size: 12px;
  word-break: break-all;
}

.map-canvas-scroll {
  flex: 1;
  min-height: 600px;
  padding: 20px;
  border-radius: 24px;
  background: var(--studio-canvas-background);
  background-size: 24px 24px;
  overflow: auto;
}

.map-canvas {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.map-image {
  display: block;
  max-width: min(100%, 1200px);
  height: auto;
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.45);
}

.pose-marker {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 999px;
}

.pose-marker.robot {
  border: 2px solid rgba(186, 230, 253, 0.95);
  background: rgba(14, 165, 233, 0.24);
  box-shadow: 0 0 0 8px rgba(14, 165, 233, 0.12);
}

.pose-arrow {
  position: absolute;
  top: -10px;
  left: 50%;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 16px solid #38bdf8;
  transform: translateX(-50%);
}

.pose-marker.goal {
  border: 3px solid #fed7aa;
  background: rgba(249, 115, 22, 0.24);
  box-shadow: 0 0 0 8px rgba(249, 115, 22, 0.12);
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.runtime-tip {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--studio-info-background);
  color: var(--studio-info-text);
  line-height: 1.6;
}

.runtime-tip-success {
  background: var(--studio-success-background);
  color: var(--studio-success-text);
}

.runtime-section {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--studio-border);
}

.runtime-section h3 {
  margin: 0 0 14px;
  font-size: 16px;
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kv-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 14px;
}

.kv-item span {
  color: var(--studio-text-muted);
}

.pose-card {
  padding: 14px 16px;
  border: 1px solid var(--studio-border);
  border-radius: 18px;
  background: var(--studio-card-background);
}

.pose-card + .pose-card {
  margin-top: 12px;
}

.pose-title {
  margin: 0 0 8px;
  color: var(--studio-text-muted);
  font-size: 13px;
}

.pose-card p:last-child {
  margin: 0;
  line-height: 1.7;
}

.robot-runtime-card {
  padding: 16px;
  border: 1px solid var(--studio-border);
  border-radius: 18px;
  background: var(--studio-card-background);
}

.robot-runtime-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.robot-runtime-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  color: var(--studio-text-muted);
  font-size: 13px;
  word-break: break-all;
}

.runtime-error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--studio-danger-background);
  color: var(--studio-danger-text);
  line-height: 1.6;
}

.telemetry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.history-empty {
  color: var(--studio-text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--studio-card-background);
  border: 1px solid var(--studio-border);
}

.history-item span,
.history-item time {
  color: var(--studio-text-muted);
  font-size: 13px;
}

@media (max-width: 1400px) {
  .status-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workbench-grid {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .runtime-panel {
    grid-column: 1 / -1;
  }

  .status-chip-wide {
    grid-column: span 2;
  }
}

@media (max-width: 980px) {
  .mapping-workbench {
    padding: 16px;
  }

  .hero-panel {
    flex-direction: column;
  }

  .status-strip,
  .workbench-grid,
  .command-grid {
    grid-template-columns: 1fr;
  }

  .status-chip-wide {
    grid-column: span 1;
  }

  .robot-select {
    width: 100%;
  }
}
</style>
