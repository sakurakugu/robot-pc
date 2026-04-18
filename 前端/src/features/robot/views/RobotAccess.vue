<template>
  <div class="robot-access">
    <header class="access-hero">
      <div>
        <p class="eyebrow">
          Robot Studio / 机器人接入
        </p>
        <h1>维护机器人资料并生成工作站接入地址</h1>
        <p class="hero-description">
          这里统一维护机器人 IP、`robot-server` 地址，并为 `robot-agent` 生成业务 WebSocket 接入地址。地图工作台和后续本地直连能力都会复用这套配置。
        </p>
      </div>
      <div class="hero-actions">
        <el-button @click="router.push('/')">
          返回首页
        </el-button>
        <el-button
          type="primary"
          @click="openCreateDialog"
        >
          新增机器人
        </el-button>
      </div>
    </header>

    <div class="layout">
      <section class="panel robot-panel">
        <div class="panel-header">
          <div>
            <h2>机器人列表</h2>
            <p>维护工作站可识别的机器人记录</p>
          </div>
          <el-tag type="info">
            {{ robots.length }} 台
          </el-tag>
        </div>

        <div
          v-if="robots.length === 0"
          class="empty-block"
        >
          <el-empty description="暂无机器人记录" />
        </div>

        <div
          v-else
          class="robot-list"
        >
          <button
            v-for="robot in robots"
            :key="robot.uuid"
            type="button"
            class="robot-card"
            :class="{ active: robot.uuid === selectedRobotId }"
            @click="selectedRobotId = robot.uuid"
          >
            <div class="robot-card-top">
              <div>
                <strong>{{ robot.name || robot.uuid }}</strong>
                <p>{{ robot.uuid }}</p>
              </div>
              <el-tag :type="statusTagTypeMap[robot.status]">
                {{ statusLabelMap[robot.status] }}
              </el-tag>
            </div>
            <div class="robot-card-meta">
              <span>IP: {{ robot.ip || '-' }}</span>
              <span>robot-server: {{ robot.serverUrl || '-' }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="panel detail-panel">
        <div class="panel-header">
          <div>
            <h2>接入详情</h2>
            <p>展示当前机器人在工作站里的配置与接入地址</p>
          </div>
        </div>

        <div
          v-if="!selectedRobot"
          class="empty-block"
        >
          <el-empty description="请选择左侧机器人" />
        </div>

        <template v-else>
          <div class="detail-card">
            <div class="detail-header">
              <div>
                <h3>{{ selectedRobot.name || selectedRobot.uuid }}</h3>
                <p>{{ selectedRobot.uuid }}</p>
              </div>
              <div class="detail-actions">
                <el-button @click="openEditDialog(selectedRobot)">
                  编辑
                </el-button>
                <el-button
                  type="danger"
                  plain
                  @click="handleDelete(selectedRobot)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-item">
                <span>机器人 IP</span>
                <strong>{{ selectedRobot.ip || '-' }}</strong>
              </div>
              <div class="detail-item">
                <span>robot-server</span>
                <strong>{{ selectedRobot.serverUrl || '-' }}</strong>
              </div>
              <div class="detail-item">
                <span>工作站状态</span>
                <strong>{{ statusLabelMap[selectedRobot.status] }}</strong>
              </div>
            </div>
          </div>

          <div class="access-section">
            <div class="section-header section-header-with-action">
              <div>
                <h3>连接诊断</h3>
                <p>从当前工作站直接探测 `robot-server`、运行时、遥测和业务通道状态。</p>
              </div>
              <div class="section-actions">
                <span
                  v-if="diagnosis"
                  class="section-caption"
                >
                  最近检测 {{ formatDateTime(diagnosis.checkedAt) }}
                </span>
                <el-button
                  size="small"
                  :loading="diagnosisLoading"
                  @click="refreshDiagnosis"
                >
                  重新诊断
                </el-button>
              </div>
            </div>

            <div
              v-if="diagnosisLoading && !diagnosis"
              class="empty-block small"
            >
              <el-skeleton
                animated
                :rows="6"
              />
            </div>

            <div
              v-else-if="diagnosis"
              class="diagnosis-grid"
            >
              <div
                v-for="card in diagnosisCards"
                :key="card.key"
                class="diagnosis-card"
                :class="`is-${card.tone}`"
              >
                <div class="diagnosis-top">
                  <div>
                    <strong>{{ card.title }}</strong>
                    <p>{{ card.message }}</p>
                  </div>
                  <el-tag :type="card.tagType">
                    {{ card.statusText }}
                  </el-tag>
                </div>
                <code v-if="card.url">{{ card.url }}</code>
                <div class="diagnosis-meta">
                  <span>耗时 {{ card.durationText }}</span>
                  <span>检测于 {{ card.checkedAtText }}</span>
                </div>
              </div>
            </div>

            <div
              v-else
              class="empty-block small"
            >
              <el-empty description="尚未获取诊断结果" />
            </div>
          </div>

          <div class="access-section">
            <div class="section-header">
              <h3>robot-agent 接入地址</h3>
              <p>把机器人业务通道地址改成以下任一地址即可</p>
            </div>

            <div
              v-if="accessCandidates.length === 0"
              class="empty-block small"
            >
              <el-empty description="暂无可用接入地址" />
            </div>

            <div
              v-else
              class="candidate-list"
            >
              <div
                v-for="candidate in accessCandidates"
                :key="candidate.businessUrlTemplate"
                class="candidate-card"
              >
                <div class="candidate-top">
                  <div>
                    <strong>{{ candidate.label }}</strong>
                    <p>{{ candidate.host }}</p>
                  </div>
                  <el-button
                    size="small"
                    @click="copyText(buildBusinessUrl(candidate))"
                  >
                    复制地址
                  </el-button>
                </div>
                <code>{{ buildBusinessUrl(candidate) }}</code>
              </div>
            </div>
          </div>

          <div class="access-section">
            <div class="section-header">
              <h3>配置建议</h3>
              <p>避免来回翻文档，直接按这里填</p>
            </div>

            <div class="guide-grid">
              <div class="guide-card">
                <span>业务通道</span>
                <code>{{ buildBusinessUrl(accessCandidates[0]) || '-' }}</code>
              </div>
              <div class="guide-card">
                <span>robot-server</span>
                <code>{{ selectedRobot.serverUrl || `http://${selectedRobot.ip}:8080` }}</code>
              </div>
              <div class="guide-card">
                <span>地图工作台使用</span>
                <p>保存后可在地图工作台直接选择该机器人并读取真机状态。</p>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingRobot ? '编辑机器人' : '新增机器人'"
      width="520px"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="96px"
      >
        <el-form-item
          label="机器人 UUID"
          prop="uuid"
        >
          <el-input
            v-model="form.uuid"
            :disabled="!!editingRobot"
            placeholder="例如 dog-alpha-001"
          />
        </el-form-item>
        <el-form-item
          label="名称"
          prop="name"
        >
          <el-input
            v-model="form.name"
            placeholder="例如 客厅 D1"
          />
        </el-form-item>
        <el-form-item
          label="机器人 IP"
          prop="ip"
        >
          <el-input
            v-model="form.ip"
            placeholder="例如 192.168.1.120"
          />
        </el-form-item>
        <el-form-item
          label="server 地址"
          prop="serverUrl"
        >
          <el-input
            v-model="form.serverUrl"
            placeholder="留空时默认按 http://IP:8080 生成"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="submitForm"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { deleteRobot, getRobotAccessInfo, getRobotDiagnosis, getRobotList, saveRobot } from '../api'
import type { Robot, RobotConnectionDiagnosis, RobotDiagnosticProbe, SaveRobotPayload, StudioAccessCandidate } from '../types'

const router = useRouter()
const robots = ref<Robot[]>([])
const accessCandidates = ref<StudioAccessCandidate[]>([])
const selectedRobotId = ref('')
const diagnosis = ref<RobotConnectionDiagnosis | null>(null)
const diagnosisLoading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const editingRobot = ref<Robot | null>(null)
const formRef = ref<FormInstance>()
let diagnosisRequestId = 0

const form = reactive<SaveRobotPayload>({
  uuid: '',
  name: '',
  ip: '',
  serverUrl: '',
})

const rules: FormRules = {
  uuid: [{ required: true, message: '请输入机器人 UUID', trigger: 'blur' }],
  name: [{ required: true, message: '请输入机器人名称', trigger: 'blur' }],
  ip: [{ required: true, message: '请输入机器人 IP', trigger: 'blur' }],
}

const statusLabelMap: Record<Robot['status'], string> = {
  online: '在线',
  offline: '离线',
  connecting: '连接中',
  error: '异常',
}

const statusTagTypeMap: Record<Robot['status'], 'success' | 'info' | 'warning' | 'danger'> = {
  online: 'success',
  offline: 'info',
  connecting: 'warning',
  error: 'danger',
}

const selectedRobot = computed(() => robots.value.find((item) => item.uuid === selectedRobotId.value) || null)

const diagnosisCards = computed(() => {
  if (!diagnosis.value) {
    return []
  }

  return [
    构建探测卡片('server', 'robot-server', diagnosis.value.server),
    构建探测卡片('runtime', '运行时探活', diagnosis.value.runtime),
    构建探测卡片('telemetry', '完整遥测', diagnosis.value.telemetry),
    构建通道卡片(diagnosis.value),
  ]
})

async function loadData(): Promise<void> {
  const [robotRes, accessRes] = await Promise.all([
    getRobotList(),
    getRobotAccessInfo(),
  ])

  robots.value = robotRes.data.robots
  accessCandidates.value = accessRes.data.candidates

  if (!robots.value.some((item) => item.uuid === selectedRobotId.value)) {
    selectedRobotId.value = robots.value[0]?.uuid || ''
  }
}

function openCreateDialog(): void {
  editingRobot.value = null
  dialogVisible.value = true
}

function openEditDialog(robot: Robot): void {
  editingRobot.value = robot
  form.uuid = robot.uuid
  form.name = robot.name || ''
  form.ip = robot.ip || ''
  form.serverUrl = robot.serverUrl || ''
  dialogVisible.value = true
}

function resetForm(): void {
  editingRobot.value = null
  form.uuid = ''
  form.name = ''
  form.ip = ''
  form.serverUrl = ''
  formRef.value?.resetFields()
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  saving.value = true
  try {
    const savedUuid = form.uuid.trim()
    await saveRobot({
      uuid: savedUuid,
      name: form.name.trim(),
      ip: form.ip.trim(),
      serverUrl: (form.serverUrl || '').trim() || undefined,
    })
    dialogVisible.value = false
    resetForm()
    await loadData()
    selectedRobotId.value = savedUuid
    ElMessage.success('机器人配置已保存')
  } catch (error) {
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function handleDelete(robot: Robot): Promise<void> {
  await ElMessageBox.confirm(`确定删除机器人 "${robot.name || robot.uuid}" 吗？`, '删除确认', {
    type: 'warning',
  })

  await deleteRobot(robot.uuid)
  ElMessage.success('机器人已删除')
  await loadData()
}

function buildBusinessUrl(candidate?: StudioAccessCandidate): string {
  if (!candidate || !selectedRobot.value) {
    return ''
  }
  return candidate.businessUrlTemplate.replace('{robotId}', encodeURIComponent(selectedRobot.value.uuid))
}

async function copyText(text: string): Promise<void> {
  if (!text) {
    return
  }
  await navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

async function loadDiagnosis(robotId: string): Promise<void> {
  const requestId = ++diagnosisRequestId
  diagnosisLoading.value = true

  try {
    const response = await getRobotDiagnosis(robotId)
    if (requestId === diagnosisRequestId) {
      diagnosis.value = response.data.diagnosis
    }
  } catch (error) {
    console.error(error)
  } finally {
    if (requestId === diagnosisRequestId) {
      diagnosisLoading.value = false
    }
  }
}

async function refreshDiagnosis(): Promise<void> {
  if (!selectedRobotId.value) {
    return
  }
  await loadDiagnosis(selectedRobotId.value)
}

function 构建探测卡片(
  key: 'server' | 'runtime' | 'telemetry',
  title: string,
  probe: RobotDiagnosticProbe,
): {
  key: string
  title: string
  message: string
  statusText: string
  url: string | null
  durationText: string
  checkedAtText: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  tagType: 'success' | 'warning' | 'danger' | 'info'
} {
  const tone = 获取探测色调(probe.status)
  return {
    key,
    title,
    message: probe.message,
    statusText: 获取探测状态文案(key, probe.status),
    url: probe.url,
    durationText: probe.durationMs == null ? '-' : `${probe.durationMs}ms`,
    checkedAtText: formatDateTime(probe.checkedAt),
    tone,
    tagType: tone,
  }
}

function 构建通道卡片(item: RobotConnectionDiagnosis): {
  key: string
  title: string
  message: string
  statusText: string
  url: string | null
  durationText: string
  checkedAtText: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  tagType: 'success' | 'warning' | 'danger' | 'info'
} {
  const connected = item.workstationWebsocket.connected
  return {
    key: 'workstation-websocket',
    title: '工作站业务通道',
    message: item.workstationWebsocket.message,
    statusText: connected ? '已连接' : '未连接',
    url: null,
    durationText: '-',
    checkedAtText: formatDateTime(item.workstationWebsocket.checkedAt),
    tone: connected ? 'success' : 'warning',
    tagType: connected ? 'success' : 'warning',
  }
}

function 获取探测色调(status: RobotDiagnosticProbe['status']): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'ok':
      return 'success'
    case 'timeout':
    case 'invalid':
      return 'warning'
    case 'refused':
    case 'error':
      return 'danger'
    case 'missing':
      return 'info'
    default:
      return 'info'
  }
}

function 获取探测状态文案(
  key: 'server' | 'runtime' | 'telemetry',
  status: RobotDiagnosticProbe['status'],
): string {
  if (status === 'ok') {
    return key === 'server' ? '可达' : '可用'
  }
  if (status === 'timeout') {
    return '超时'
  }
  if (status === 'refused') {
    return '拒绝'
  }
  if (status === 'invalid') {
    return '响应异常'
  }
  if (status === 'missing') {
    return '未配置'
  }
  return '异常'
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

watch(selectedRobotId, async (robotId) => {
  diagnosis.value = null
  diagnosisLoading.value = false

  if (!robotId) {
    return
  }

  await loadDiagnosis(robotId)
})

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.robot-access {
  min-height: 100%;
  padding: 28px;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 24%),
    radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.14), transparent 28%),
    #08111c;
  color: #edf3ff;
}

.access-hero,
.panel {
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(9, 17, 27, 0.78);
  box-shadow: 0 24px 60px rgba(1, 7, 18, 0.32);
  backdrop-filter: blur(14px);
}

.access-hero {
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

.access-hero h1 {
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
  gap: 12px;
  align-items: flex-start;
}

.layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 18px;
  margin-top: 18px;
}

.panel {
  border-radius: 28px;
  padding: 22px;
}

.panel-header,
.detail-header,
.candidate-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.panel-header h2,
.detail-header h3,
.section-header h3 {
  margin: 0;
}

.panel-header p,
.detail-header p,
.section-header p {
  margin: 8px 0 0;
  color: rgba(226, 232, 240, 0.66);
  line-height: 1.5;
}

.robot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 18px;
}

.robot-card {
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

.robot-card:hover,
.robot-card.active {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.76);
  box-shadow: 0 18px 36px rgba(59, 130, 246, 0.15);
}

.robot-card-top strong {
  display: block;
  font-size: 16px;
}

.robot-card-top p {
  margin: 6px 0 0;
  color: rgba(226, 232, 240, 0.66);
}

.robot-card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.66);
  word-break: break-all;
}

.empty-block {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.empty-block.small {
  min-height: 180px;
}

.detail-card,
.candidate-card,
.guide-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.42);
}

.detail-actions {
  display: flex;
  gap: 10px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.detail-item span,
.guide-card span {
  display: block;
  color: rgba(226, 232, 240, 0.66);
  font-size: 13px;
}

.detail-item strong,
.guide-card code,
.candidate-card code {
  display: block;
  margin-top: 10px;
  line-height: 1.6;
  word-break: break-all;
}

.access-section {
  margin-top: 18px;
}

.section-header {
  margin-bottom: 14px;
}

.section-header-with-action,
.section-actions,
.diagnosis-top,
.diagnosis-meta {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.section-actions {
  align-items: center;
}

.section-caption {
  color: rgba(226, 232, 240, 0.66);
  font-size: 12px;
}

.diagnosis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.diagnosis-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.48);
}

.diagnosis-card.is-success {
  border-color: rgba(74, 222, 128, 0.36);
}

.diagnosis-card.is-warning {
  border-color: rgba(250, 204, 21, 0.36);
}

.diagnosis-card.is-danger {
  border-color: rgba(248, 113, 113, 0.36);
}

.diagnosis-card.is-info {
  border-color: rgba(148, 163, 184, 0.24);
}

.diagnosis-top strong {
  display: block;
}

.diagnosis-top p {
  margin: 8px 0 0;
  color: rgba(226, 232, 240, 0.72);
  line-height: 1.6;
}

.diagnosis-card code {
  display: block;
  margin-top: 14px;
  line-height: 1.6;
  word-break: break-all;
}

.diagnosis-meta {
  margin-top: 14px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.58);
}

.candidate-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.candidate-top strong {
  display: block;
}

.candidate-top p {
  margin: 6px 0 0;
  color: rgba(226, 232, 240, 0.66);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.guide-card p {
  margin: 10px 0 0;
  color: rgba(226, 232, 240, 0.72);
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .layout,
  .diagnosis-grid,
  .candidate-list,
  .guide-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .robot-access {
    padding: 16px;
  }

  .access-hero {
    flex-direction: column;
  }

  .hero-actions,
  .detail-actions,
  .section-actions,
  .diagnosis-meta {
    flex-direction: column;
  }
}
</style>
