<template>
  <div class="mapping-workbench">
    <header class="hero-panel">
      <div>
        <p class="eyebrow">
          Robot Studio / 地图工作台
        </p>
        <h1>地图查看、建图调试与定位联调</h1>
        <p class="hero-description">
          当前先接本地工作站地图目录与运行态桩接口，后续可继续替换成真机导航状态、雷达轨迹和建图进度流。
        </p>
      </div>
      <div class="hero-actions">
        <el-button @click="goHome">
          返回首页
        </el-button>
        <el-button
          type="primary"
          :loading="loading"
          @click="refreshAll"
        >
          <el-icon><RefreshRight /></el-icon>
          刷新状态
        </el-button>
      </div>
    </header>

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
            @click="sendCommand('start_mapping')"
          >
            开始建图
          </el-button>
          <el-button
            type="primary"
            plain
            :disabled="!selectedMap"
            @click="sendCommand('load_map', selectedMap?.id)"
          >
            加载选中地图
          </el-button>
          <el-button
            type="success"
            plain
            :disabled="!selectedMap"
            @click="sendCommand('start_localization', selectedMap?.id)"
          >
            启动定位
          </el-button>
          <el-button
            plain
            :disabled="!runtime.localizationActive"
            @click="sendCommand('stop_localization')"
          >
            停止定位
          </el-button>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { mappingApi } from '../api'
import type { MappingCommand, MappingRuntime, PlanarPose, StudioMap } from '../types'

const router = useRouter()
const loading = ref(false)
const maps = ref<StudioMap[]>([])
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

const selectedMap = computed(() => maps.value.find((item) => item.id === selectedMapId.value) || null)
const activeMap = computed(() => maps.value.find((item) => item.id === runtime.value.activeMapId) || null)

const currentPoseStyle = computed(() => buildPoseStyle(runtime.value.currentPose, true))
const goalPoseStyle = computed(() => buildPoseStyle(runtime.value.goalPose, false))

let pollTimer: number | null = null

async function refreshAll(): Promise<void> {
  loading.value = true
  try {
    const [mapsResponse, runtimeResponse] = await Promise.all([
      mappingApi.getMaps(),
      mappingApi.getRuntime(),
    ])

    maps.value = mapsResponse.data.maps
    runtime.value = runtimeResponse.data

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
    const response = await mappingApi.sendCommand(command, mapId)
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

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
  }
})
</script>

<style scoped>
.mapping-workbench {
  min-height: 100%;
  padding: 28px;
  background:
    radial-gradient(circle at top right, rgba(35, 161, 255, 0.18), transparent 25%),
    radial-gradient(circle at bottom left, rgba(74, 222, 128, 0.14), transparent 28%),
    #09111b;
  color: #edf3ff;
}

.hero-panel,
.panel,
.status-chip {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(9, 17, 27, 0.76);
  box-shadow: 0 24px 60px rgba(1, 7, 18, 0.32);
  backdrop-filter: blur(14px);
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px;
  border-radius: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8ab4ff;
}

.hero-panel h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.15;
}

.hero-description {
  max-width: 780px;
  margin: 14px 0 0;
  color: rgba(232, 240, 255, 0.72);
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
  color: rgba(226, 232, 240, 0.62);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.path-text {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
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
  color: rgba(226, 232, 240, 0.66);
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
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(12, 22, 35, 0.92), rgba(9, 17, 27, 0.78));
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.map-card:hover,
.map-card.active {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.76);
  box-shadow: 0 18px 36px rgba(59, 130, 246, 0.15);
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
  color: rgba(226, 232, 240, 0.66);
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
  background: rgba(15, 23, 42, 0.88);
  color: #dbeafe;
  word-break: break-all;
}

.viewer-panel {
  display: flex;
  flex-direction: column;
}

.canvas-legend {
  display: flex;
  gap: 14px;
  color: rgba(226, 232, 240, 0.76);
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
  color: rgba(226, 232, 240, 0.6);
  font-size: 12px;
  word-break: break-all;
}

.map-canvas-scroll {
  flex: 1;
  min-height: 600px;
  padding: 20px;
  border-radius: 24px;
  background:
    linear-gradient(90deg, rgba(59, 130, 246, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(59, 130, 246, 0.06) 1px, transparent 1px),
    #030811;
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

.runtime-section {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
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
  color: rgba(226, 232, 240, 0.68);
}

.pose-card {
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.45);
}

.pose-card + .pose-card {
  margin-top: 12px;
}

.pose-title {
  margin: 0 0 8px;
  color: rgba(226, 232, 240, 0.66);
  font-size: 13px;
}

.pose-card p:last-child {
  margin: 0;
  line-height: 1.7;
}

.history-empty {
  color: rgba(226, 232, 240, 0.68);
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
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.history-item span,
.history-item time {
  color: rgba(226, 232, 240, 0.66);
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
}
</style>
