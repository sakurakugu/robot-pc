<template>
  <div class="developer-tools-page">
    <PageHeader
      title="开发者工具"
      :icon="Tools"
      @back="router.push('/')"
    />

    <section class="tool-grid">
      <el-card class="tool-card">
        <template #header>
          <div class="card-header">
            <div>
              <span>任务配置</span>
              <p>调用本体工具脚本执行本地打包、SSH 上传和远程安装。</p>
            </div>
            <div class="config-actions">
              <el-tag
                :type="toolInfo ? 'success' : 'info'"
                effect="dark"
              >
                {{ toolInfo ? '脚本已发现' : '等待检测' }}
              </el-tag>
              <el-button
                text
                :loading="loadingInfo"
                @click="loadInfo"
              >
                重新检测
              </el-button>
            </div>
          </div>
        </template>

        <el-alert
          v-if="infoError"
          :title="infoError"
          type="warning"
          show-icon
          :closable="false"
        />

        <dl
          v-if="toolInfo"
          class="tool-meta"
        >
          <div>
            <dt>本体目录</dt>
            <dd>{{ toolInfo.onboardDir }}</dd>
          </div>
          <div>
            <dt>Python</dt>
            <dd>{{ toolInfo.pythonCommand }}</dd>
          </div>
          <div>
            <dt>脚本</dt>
            <dd>{{ toolInfo.scriptPath }}</dd>
          </div>
        </dl>

        <el-form
          class="task-form"
          label-position="top"
        >
          <el-form-item label="任务模式">
            <el-radio-group v-model="form.mode">
              <el-radio-button label="package">
                本地打包
              </el-radio-button>
              <el-radio-button label="install">
                SSH 安装
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="任务">
            <el-select
              v-model="form.task"
              class="full-width"
            >
              <el-option
                v-for="item in taskOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="打包格式">
            <el-select
              v-model="form.format"
              class="full-width"
            >
              <el-option
                v-for="format in formatOptions"
                :key="format"
                :label="format"
                :value="format"
              />
            </el-select>
          </el-form-item>

          <div
            v-if="form.mode !== 'package'"
            class="ssh-fields"
          >
            <el-form-item label="机器狗 IP">
              <el-input
                v-model="form.robotIp"
                placeholder="例如 192.168.1.106"
              />
            </el-form-item>
          </div>

          <el-button
            type="primary"
            size="large"
            :loading="starting"
            :disabled="hasRunningJob"
            @click="startJob"
          >
            {{ hasRunningJob ? '已有任务运行中' : '启动任务' }}
          </el-button>
        </el-form>
      </el-card>

      <el-card class="tool-card log-card">
        <template #header>
          <div class="card-header">
            <span>任务日志</span>
            <div class="job-actions">
              <el-tag
                v-if="currentJob"
                :type="statusTagType(currentJob.status)"
              >
                {{ statusText(currentJob.status) }}
              </el-tag>
              <el-button
                text
                :disabled="!currentJob"
                @click="refreshCurrentJob"
              >
                刷新
              </el-button>
            </div>
          </div>
        </template>

        <div
          v-if="currentJob"
          class="job-summary"
        >
          <span>任务：{{ modeText(currentJob.mode) }} / {{ taskText(currentJob.task) }}</span>
          <span>开始：{{ formatTime(currentJob.startedAt) }}</span>
          <span v-if="currentJob.finishedAt">结束：{{ formatTime(currentJob.finishedAt) }}</span>
          <span v-if="currentJob.exitCode !== null">退出码：{{ currentJob.exitCode }}</span>
        </div>
        <pre class="log-output">{{ currentJob?.logs || '还没有任务日志。' }}</pre>
      </el-card>
    </section>

    <section class="history-section">
      <div class="section-header">
        <h3>最近任务</h3>
        <el-button
          text
          @click="loadJobs"
        >
          刷新列表
        </el-button>
      </div>
      <el-table
        :data="jobs"
        border
        empty-text="暂无任务"
      >
        <el-table-column
          prop="startedAt"
          label="开始时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatTime(row.startedAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="任务"
          min-width="180"
        >
          <template #default="{ row }">
            {{ modeText(row.mode) }} / {{ taskText(row.task) }}
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="110"
        >
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="error"
          label="错误"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          label="操作"
          width="100"
        >
          <template #default="{ row }">
            <el-button
              text
              @click="selectJob(row.id)"
            >
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/share/components/PageHeader.vue'
import { Tools } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { developerApi } from '../api'
import type {
  OnboardToolInfo,
  OnboardToolJob,
  OnboardToolJobStatus,
  OnboardToolMode,
  OnboardToolPackageFormat,
  OnboardToolTask,
} from '../types'

const router = useRouter()

const taskOptions: Array<{ label: string; value: OnboardToolTask }> = [
  { label: 'sparkrobot-common', value: 'common' },
  { label: 'robot-server', value: 'server' },
  { label: 'robot-agent', value: 'agent' },
  { label: 'robot-runtime', value: 'runtime' },
  { label: 'robot-ros 工作区', value: 'ros' },
  { label: '本体全套', value: 'full' },
]
const formatOptions: OnboardToolPackageFormat[] = ['tar.gz', 'zip', 'tar', 'tar.bz2', 'tar.xz']

const form = reactive<{
  mode: OnboardToolMode
  task: OnboardToolTask
  format: OnboardToolPackageFormat
  robotIp: string
}>({
  mode: 'install',
  task: 'full',
  format: 'tar.gz',
  robotIp: '',
})

const toolInfo = ref<OnboardToolInfo | null>(null)
const infoError = ref('')
const loadingInfo = ref(false)
const starting = ref(false)
const currentJob = ref<OnboardToolJob | null>(null)
const jobs = ref<OnboardToolJob[]>([])
let pollTimer: number | undefined

const hasRunningJob = computed(() => currentJob.value?.status === 'running')

onMounted(async () => {
  await Promise.all([loadInfo(), loadJobs()])
})

onBeforeUnmount(() => {
  stopPolling()
})

async function loadInfo(): Promise<void> {
  loadingInfo.value = true
  infoError.value = ''
  try {
    const response = await developerApi.getOnboardToolInfo()
    toolInfo.value = response.data
    const runningJob = response.data.runningJobs[0]
    if (runningJob) {
      currentJob.value = runningJob
      startPolling(runningJob.id)
    }
  } catch (error) {
    infoError.value = error instanceof Error ? error.message : '检测本体工具失败'
  } finally {
    loadingInfo.value = false
  }
}

async function loadJobs(): Promise<void> {
  const response = await developerApi.getOnboardToolJobs()
  jobs.value = response.data.jobs
}

async function startJob(): Promise<void> {
  if (form.mode !== 'package' && !form.robotIp.trim()) {
    ElMessage.warning('请先填写机器狗 IP')
    return
  }

  starting.value = true
  try {
    const payload = {
      mode: form.mode,
      task: form.task,
      robotIp: form.mode === 'package' ? undefined : form.robotIp.trim(),
      format: form.format,
    }
    const response = await developerApi.startOnboardToolJob(payload)
    currentJob.value = response.data
    ElMessage.success('任务已启动')
    await loadJobs()
    startPolling(response.data.id)
  } finally {
    starting.value = false
  }
}

async function refreshCurrentJob(): Promise<void> {
  if (!currentJob.value) {
    return
  }
  const response = await developerApi.getOnboardToolJob(currentJob.value.id)
  currentJob.value = response.data
  await loadJobs()
  if (response.data.status !== 'running') {
    stopPolling()
  }
}

async function selectJob(jobId: string): Promise<void> {
  const response = await developerApi.getOnboardToolJob(jobId)
  currentJob.value = response.data
  if (response.data.status === 'running') {
    startPolling(jobId)
  } else {
    stopPolling()
  }
}

function startPolling(jobId: string): void {
  stopPolling()
  pollTimer = window.setInterval(async () => {
    try {
      const response = await developerApi.getOnboardToolJob(jobId)
      currentJob.value = response.data
      if (response.data.status !== 'running') {
        stopPolling()
        await loadJobs()
      }
    } catch {
      stopPolling()
    }
  }, 2000)
}

function stopPolling(): void {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function statusTagType(status: OnboardToolJobStatus): 'success' | 'warning' | 'danger' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  return 'warning'
}

function statusText(status: OnboardToolJobStatus): string {
  const mapping: Record<OnboardToolJobStatus, string> = {
    running: '运行中',
    success: '成功',
    failed: '失败',
  }
  return mapping[status]
}

function modeText(mode: OnboardToolMode): string {
  const mapping: Record<OnboardToolMode, string> = {
    package: '本地打包',
    install: 'SSH 安装',
  }
  return mapping[mode]
}

function taskText(task: OnboardToolTask): string {
  return taskOptions.find((item) => item.value === task)?.label || task
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString()
}
</script>

<style scoped>
.developer-tools-page {
  min-height: 100%;
  padding: 32px;
  background:
    radial-gradient(circle at 18% 8%, rgba(245, 158, 11, 0.16), transparent 28%),
    radial-gradient(circle at 88% 2%, rgba(14, 165, 233, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.04), transparent 260px),
    var(--el-bg-color-page);
}

.history-section,
.tool-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 20px;
  background: color-mix(in srgb, var(--el-bg-color) 94%, white 6%);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
}

.tool-grid {
  display: grid;
  grid-template-columns: minmax(360px, 0.82fr) minmax(480px, 1.18fr);
  gap: 22px;
}

.card-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.config-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header,
.section-header,
.job-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tool-meta {
  display: grid;
  gap: 10px;
  margin: 0 0 22px;
  padding: 14px;
  border-radius: 14px;
  background: var(--el-fill-color-lighter);
}

.tool-meta div {
  min-width: 0;
}

.tool-meta dt {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tool-meta dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
}

.task-form {
  margin-top: 18px;
}

.full-width {
  width: 100%;
}

.ssh-fields {
  display: block;
}

.log-card {
  min-width: 0;
}

.job-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.log-output {
  min-height: 420px;
  max-height: 620px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border-radius: 16px;
  background: #0f172a;
  color: #d1fae5;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.history-section {
  margin-top: 22px;
  padding: 22px;
}

.section-header {
  margin-bottom: 14px;
}

.section-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

@media (max-width: 1180px) {
  .tool-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .developer-tools-page {
    padding: 20px;
  }

}
</style>
