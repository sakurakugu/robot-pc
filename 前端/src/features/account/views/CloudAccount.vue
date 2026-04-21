<template>
  <div class="cloud-account-page">
    <PageHeader
      title="个人中心"
      :icon="UserFilled"
      @back="router.push('/')"
    >
      <template #extra>
        <div class="header-actions">
          <el-button
            :icon="RefreshRight"
            :loading="pageLoading"
            @click="refreshPage"
          >
            刷新
          </el-button>
        </div>
      </template>
    </PageHeader>

    <section class="page-grid">
      <article class="panel-card">
        <div class="section-header">
          <div>
            <h3>连接云端</h3>
            <p>这里保存工作站要连接的云端地址。修改地址后，当前登录状态会清空，避免旧 token 误用到另一套云端。</p>
          </div>
          <el-tag :type="connectionTagType">
            {{ connectionStatusText }}
          </el-tag>
        </div>

        <el-form
          label-position="top"
          class="stack-form"
        >
          <el-form-item label="云端环境">
            <div class="environment-toolbar">
              <el-select
                v-model="selectedEnvironmentId"
                placeholder="请选择云端环境"
                @change="handleSelectEnvironment"
              >
                <el-option
                  v-for="item in cloudEnvironments"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
              <div class="environment-actions">
                <el-button
                  plain
                  :icon="Plus"
                  @click="openCreateEnvironmentDialog"
                >
                  新增环境
                </el-button>
                <el-button
                  plain
                  type="danger"
                  :icon="Delete"
                  :disabled="isCurrentEnvironmentDefault"
                  @click="handleDeleteEnvironment"
                >
                  删除环境
                </el-button>
              </div>
            </div>
          </el-form-item>
          <el-form-item label="环境名称">
            <div class="environment-name-row">
              <el-input
                v-model="environmentNameDraft"
                placeholder="例如 服务器环境、测试环境"
              />
              <el-tag :type="isCurrentEnvironmentDefault ? 'info' : 'success'">
                {{ isCurrentEnvironmentDefault ? '默认环境' : '自定义环境' }}
              </el-tag>
            </div>
          </el-form-item>
          <el-form-item label="云端地址">
            <el-input
              v-model="cloudBaseUrlDraft"
              placeholder="例如 https://cloud.example.com 或 192.168.1.10:9000"
            />
          </el-form-item>
          <div class="form-actions">
            <el-button
              type="primary"
              :loading="savingConfig"
              @click="handleSaveConfig"
            >
              保存环境
            </el-button>
            <el-button
              :loading="testingConnection"
              @click="handleTestConnection"
            >
              测试连接
            </el-button>
          </div>
        </el-form>

        <el-alert
          class="inline-alert"
          :title="connectionMessage"
          :type="connectionAlertType"
          :closable="false"
          show-icon
        />
      </article>

      <article class="panel-card">
        <div class="section-header">
          <div>
            <h3>{{ isAuthenticated ? '当前账号' : '登录 / 注册' }}</h3>
            <p v-if="isAuthenticated">
              当前工作站已连接账号，可直接查看角色和会话。
            </p>
            <p v-else>
              先配置云端地址，再使用账号登录电脑端工作站。
            </p>
          </div>
          <el-tag :type="isAuthenticated ? 'success' : 'info'">
            {{ isAuthenticated ? '已登录' : '未登录' }}
          </el-tag>
        </div>

        <template v-if="!cloudBaseUrl">
          <el-empty description="请先配置云端地址" />
        </template>

        <template v-else-if="isAuthenticated && user">
          <div class="profile-block">
            <el-descriptions
              :column="1"
              border
              class="profile-descriptions"
            >
              <el-descriptions-item label="用户 ID">
                {{ user.id }}
              </el-descriptions-item>
              <el-descriptions-item label="用户名">
                {{ user.username }}
              </el-descriptions-item>
              <el-descriptions-item label="昵称">
                {{ user.nickname || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="邮箱">
                {{ user.email || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="角色权限">
                <el-tag
                  :type="roleTagType"
                  size="small"
                >
                  {{ roleText }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="审核状态">
                <el-tag
                  :type="approvalTagType"
                  size="small"
                >
                  {{ approvalText }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="最近登录">
                {{ formatDateTime(user.lastLoginAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="注册时间">
                {{ formatDateTime(user.createdAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="账号状态">
                {{ user.isActive ? '启用中' : '已停用' }}
              </el-descriptions-item>
              <el-descriptions-item label="个人简介">
                {{ user.bio || '暂未填写' }}
              </el-descriptions-item>
            </el-descriptions>

            <div class="form-actions">
              <el-button
                type="primary"
                plain
                @click="openFeedbackDialog"
              >
                提交反馈
              </el-button>
              <el-button @click="handleRefreshProfile">
                刷新资料
              </el-button>
              <el-button
                type="danger"
                plain
                @click="handleLogout"
              >
                退出登录
              </el-button>
            </div>
          </div>
        </template>

        <template v-else>
          <el-tabs v-model="activeTab">
            <el-tab-pane
              label="登录"
              name="login"
            >
              <el-form
                label-position="top"
                class="stack-form"
              >
                <el-form-item label="用户名">
                  <el-input
                    v-model="loginForm.username"
                    autocomplete="username"
                    placeholder="请输入用户名"
                  />
                </el-form-item>
                <el-form-item label="密码">
                  <el-input
                    v-model="loginForm.password"
                    type="password"
                    show-password
                    autocomplete="current-password"
                    placeholder="请输入密码"
                    @keyup.enter="handleLogin"
                  />
                </el-form-item>
                <el-button
                  type="primary"
                  :loading="submittingAuth"
                  @click="handleLogin"
                >
                  登录云端
                </el-button>
              </el-form>
            </el-tab-pane>

            <el-tab-pane
              v-if="registerEnabled"
              label="注册"
              name="register"
            >
              <el-alert
                v-if="registerApprovalRequired"
                class="inline-alert"
                title="当前注册需要主管理员审核，通过后才能登录"
                type="warning"
                :closable="false"
                show-icon
              />
              <el-form
                label-position="top"
                class="stack-form"
              >
                <el-form-item label="用户名">
                  <el-input
                    v-model="registerForm.username"
                    autocomplete="username"
                    placeholder="请输入用户名"
                  />
                </el-form-item>
                <el-form-item label="密码">
                  <el-input
                    v-model="registerForm.password"
                    type="password"
                    show-password
                    autocomplete="new-password"
                    placeholder="至少 6 位"
                    @keyup.enter="handleRegister"
                  />
                </el-form-item>
                <el-button
                  type="primary"
                  :loading="submittingAuth"
                  @click="handleRegister"
                >
                  注册账号
                </el-button>
              </el-form>
            </el-tab-pane>
          </el-tabs>

          <el-alert
            v-if="!registerEnabled"
            class="inline-alert"
            title="当前云端已关闭新用户注册，请联系管理员开通"
            type="info"
            :closable="false"
            show-icon
          />
        </template>
      </article>
    </section>

    <section
      v-if="isAuthenticated"
      class="panel-card sessions-card"
    >
      <div class="section-header">
        <div>
          <h3>登录设备</h3>
          <p>查看当前账号在哪些设备登录，并支持将其它设备下线。</p>
        </div>
        <el-button @click="handleRefreshSessions">
          刷新设备
        </el-button>
      </div>

      <el-table
        :data="sessions"
        border
        empty-text="暂无活跃设备"
      >
        <el-table-column
          prop="deviceName"
          label="设备"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          prop="clientType"
          label="类型"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.clientType === 'mobile' ? 'warning' : 'primary'"
            >
              {{ clientTypeText(row.clientType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="ipAddress"
          label="IP"
          width="150"
        />
        <el-table-column
          prop="lastSeenAt"
          label="最近活跃"
          min-width="180"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.lastSeenAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="140"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.current"
              type="success"
            >
              当前设备
            </el-tag>
            <el-button
              v-else
              size="small"
              type="danger"
              plain
              @click="handleRevokeSession(row.id)"
            >
              下线
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="environmentDialogVisible"
      title="新增云端环境"
      width="460px"
      destroy-on-close
    >
      <el-form
        label-position="top"
        class="stack-form"
      >
        <el-form-item label="环境名称">
          <el-input
            v-model="newEnvironmentForm.name"
            placeholder="例如 测试环境"
          />
        </el-form-item>
        <el-form-item label="云端地址">
          <el-input
            v-model="newEnvironmentForm.baseUrl"
            placeholder="例如 http://192.168.1.10:9000"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="environmentDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="creatingEnvironment"
          @click="handleCreateEnvironment"
        >
          保存并启用
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="feedbackDialogVisible"
      title="提交反馈"
      width="520px"
      destroy-on-close
    >
      <el-input
        v-model="feedbackContent"
        type="textarea"
        :rows="6"
        maxlength="1000"
        show-word-limit
        placeholder="请输入反馈内容"
      />
      <template #footer>
        <el-button @click="feedbackDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="feedbackSubmitting"
          :disabled="!feedbackContent.trim()"
          @click="handleSubmitFeedback"
        >
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { submitFeedback } from '@/features/account/api'
import type { CloudEnvironment, StudioUiConfig } from '@/features/account/types'
import { useCloudAccountStore } from '@/features/account/store'
import PageHeader from '@/share/components/PageHeader.vue'
import { Delete, Plus, RefreshRight, UserFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const accountStore = useCloudAccountStore()

const activeTab = ref<'login' | 'register'>('login')
const selectedEnvironmentId = ref(accountStore.activeCloudEnvironmentId.value)
const environmentNameDraft = ref(accountStore.activeCloudEnvironment.value?.name || '')
const cloudBaseUrlDraft = ref(accountStore.activeCloudEnvironment.value?.baseUrl || '')
const savingConfig = ref(false)
const testingConnection = ref(false)
const submittingAuth = ref(false)
const pageLoading = ref(false)
const environmentDialogVisible = ref(false)
const creatingEnvironment = ref(false)
const feedbackDialogVisible = ref(false)
const feedbackContent = ref('')
const feedbackSubmitting = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  password: '',
})

const newEnvironmentForm = reactive({
  name: '',
  baseUrl: '',
})

const cloudEnvironments = computed(() => accountStore.cloudEnvironments.value)
const cloudBaseUrl = computed(() => accountStore.cloudBaseUrl.value)
const activeCloudEnvironmentId = computed(() => accountStore.activeCloudEnvironmentId.value)
const user = computed(() => accountStore.user.value)
const sessions = computed(() => accountStore.sessions.value)
const registerEnabled = computed(() => accountStore.registerEnabled.value)
const registerApprovalRequired = computed(() => accountStore.registerApprovalRequired.value)
const isAuthenticated = computed(() => accountStore.isAuthenticated.value)
const connectionStatusText = computed(() => accountStore.connectionStatusText.value)
const connectionMessage = computed(() => accountStore.connectionMessage.value)
const isCurrentEnvironmentDefault = computed(() => 是否默认环境(selectedEnvironmentId.value))

const connectionTagType = computed(() => {
  switch (accountStore.connectionState.value) {
    case 'connected':
      return 'success'
    case 'checking':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

const connectionAlertType = computed(() => {
  switch (accountStore.connectionState.value) {
    case 'connected':
      return 'success'
    case 'checking':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'info'
  }
})

const roleText = computed(() => {
  switch (user.value?.role) {
    case 'super_admin':
      return '主管理员'
    case 'admin':
      return '管理员'
    case 'user':
      return '普通用户'
    default:
      return isAuthenticated.value ? '未知角色' : '未登录'
  }
})

const roleTagType = computed(() => {
  switch (user.value?.role) {
    case 'super_admin':
      return 'danger'
    case 'admin':
      return 'warning'
    case 'user':
      return 'primary'
    default:
      return 'info'
  }
})

const approvalText = computed(() => {
  switch (user.value?.approvalStatus) {
    case 'approved':
      return '已审核'
    case 'rejected':
      return '已拒绝'
    case 'pending':
      return '待审核'
    default:
      return '状态未知'
  }
})

const approvalTagType = computed(() => {
  switch (user.value?.approvalStatus) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'pending':
      return 'warning'
    default:
      return 'info'
  }
})

watch(
  [cloudEnvironments, activeCloudEnvironmentId],
  ([environments, activeId]) => {
    const nextId = activeId || environments[0]?.id || ''
    selectedEnvironmentId.value = nextId
    同步当前环境草稿(environments, nextId)
  },
  { immediate: true },
)

async function refreshPage(): Promise<void> {
  pageLoading.value = true
  try {
    await accountStore.loadStudioConfig()
    const connected = await accountStore.checkCloudConnection(true)
    if (connected && isAuthenticated.value) {
      await Promise.all([
        accountStore.refreshProfile(true),
        accountStore.refreshSessions(true),
      ])
    }
  } finally {
    pageLoading.value = false
  }
}

async function handleSaveConfig(): Promise<void> {
  const normalizedEnvironment = 构建当前环境草稿()
  if (!normalizedEnvironment) {
    return
  }

  savingConfig.value = true
  try {
    const config = await accountStore.saveCloudEnvironmentConfig({
      cloudEnvironments: 替换当前环境(normalizedEnvironment),
      activeCloudEnvironmentId: selectedEnvironmentId.value,
    })
    应用配置到草稿(config)
    ElMessage.success('云端环境已保存')
  } finally {
    savingConfig.value = false
  }
}

async function handleTestConnection(): Promise<void> {
  const normalizedEnvironment = 构建当前环境草稿()
  if (!normalizedEnvironment) {
    return
  }

  testingConnection.value = true
  try {
    await accountStore.saveCloudEnvironmentConfig({
      cloudEnvironments: 替换当前环境(normalizedEnvironment),
      activeCloudEnvironmentId: selectedEnvironmentId.value,
    })
    if (accountStore.connectionState.value !== 'connected') {
      return
    }
    ElMessage.success('云端连接正常')
  } finally {
    testingConnection.value = false
  }
}

async function handleSelectEnvironment(id: string): Promise<void> {
  if (!id || id === activeCloudEnvironmentId.value) {
    return
  }

  try {
    const config = await accountStore.saveCloudEnvironmentConfig({
      cloudEnvironments: cloudEnvironments.value,
      activeCloudEnvironmentId: id,
    })
    应用配置到草稿(config)
  } catch {
    selectedEnvironmentId.value = activeCloudEnvironmentId.value
    同步当前环境草稿(cloudEnvironments.value, activeCloudEnvironmentId.value)
  }
}

function openCreateEnvironmentDialog(): void {
  newEnvironmentForm.name = ''
  newEnvironmentForm.baseUrl = ''
  environmentDialogVisible.value = true
}

async function handleCreateEnvironment(): Promise<void> {
  const name = newEnvironmentForm.name.trim()
  const baseUrl = 规范化云端地址(newEnvironmentForm.baseUrl)

  if (!name || !baseUrl) {
    ElMessage.warning('请输入环境名称和云端地址')
    return
  }

  creatingEnvironment.value = true
  try {
    const nextEnvironment: CloudEnvironment = {
      id: `custom-${Date.now()}`,
      name,
      baseUrl,
    }
    const config = await accountStore.saveCloudEnvironmentConfig({
      cloudEnvironments: [...cloudEnvironments.value, nextEnvironment],
      activeCloudEnvironmentId: nextEnvironment.id,
    })
    应用配置到草稿(config)
    environmentDialogVisible.value = false
    ElMessage.success('云端环境已新增')
  } finally {
    creatingEnvironment.value = false
  }
}

async function handleDeleteEnvironment(): Promise<void> {
  const currentEnvironment = cloudEnvironments.value.find((item) => item.id === selectedEnvironmentId.value)
  if (!currentEnvironment) {
    ElMessage.warning('当前环境不存在')
    return
  }
  if (是否默认环境(currentEnvironment.id)) {
    ElMessage.warning('默认环境不允许删除')
    return
  }

  try {
    await ElMessageBox.confirm(`确定删除云端环境「${currentEnvironment.name}」吗？`, '删除环境', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  const nextEnvironments = cloudEnvironments.value.filter((item) => item.id !== currentEnvironment.id)
  const fallbackEnvironmentId = activeCloudEnvironmentId.value === currentEnvironment.id
    ? nextEnvironments[0]?.id || ''
    : activeCloudEnvironmentId.value

  const config = await accountStore.saveCloudEnvironmentConfig({
    cloudEnvironments: nextEnvironments,
    activeCloudEnvironmentId: fallbackEnvironmentId,
  })
  应用配置到草稿(config)
  ElMessage.success('云端环境已删除')
}

async function handleLogin(): Promise<void> {
  if (!loginForm.username.trim() || !loginForm.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  submittingAuth.value = true
  try {
    await accountStore.login(loginForm.username.trim(), loginForm.password)
    loginForm.password = ''
    ElMessage.success('云端登录成功')
    await accountStore.refreshSessions(true)
  } finally {
    submittingAuth.value = false
  }
}

async function handleRegister(): Promise<void> {
  if (!registerForm.username.trim() || !registerForm.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  if (registerForm.password.length < 6) {
    ElMessage.warning('密码至少需要 6 位')
    return
  }

  submittingAuth.value = true
  try {
    const result = await accountStore.register(registerForm.username.trim(), registerForm.password)
    if (result.requiresApproval) {
      ElMessage.success(result.message || '注册成功，等待审核')
      loginForm.username = registerForm.username.trim()
      registerForm.password = ''
      activeTab.value = 'login'
      return
    }

    registerForm.password = ''
    ElMessage.success(result.message || '注册成功')
    await accountStore.refreshSessions(true)
  } finally {
    submittingAuth.value = false
  }
}

async function handleRefreshProfile(): Promise<void> {
  await accountStore.refreshProfile(false)
  ElMessage.success('账号资料已刷新')
}

function openFeedbackDialog(): void {
  feedbackContent.value = ''
  feedbackDialogVisible.value = true
}

async function handleSubmitFeedback(): Promise<void> {
  const content = feedbackContent.value.trim()
  if (!content || feedbackSubmitting.value) {
    return
  }

  feedbackSubmitting.value = true
  try {
    await submitFeedback({ content })
    ElMessage.success('反馈提交成功')
    feedbackDialogVisible.value = false
    feedbackContent.value = ''
  } catch (error: any) {
    ElMessage.error(error?.message || '反馈提交失败')
  } finally {
    feedbackSubmitting.value = false
  }
}

async function handleLogout(): Promise<void> {
  await accountStore.logout()
  ElMessage.success('已退出当前账号')
}

async function handleRefreshSessions(): Promise<void> {
  await accountStore.refreshSessions(false)
  ElMessage.success('登录设备已刷新')
}

async function handleRevokeSession(id: string): Promise<void> {
  await accountStore.revokeSession(id)
}

function clientTypeText(value: string): string {
  if (value === 'mobile') {
    return '手机端'
  }
  if (value === 'web') {
    return 'Web'
  }
  return value || '未知'
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

void accountStore.initialize()

function 同步当前环境草稿(environments: CloudEnvironment[], environmentId: string): void {
  const currentEnvironment = environments.find((item) => item.id === environmentId) || environments[0]
  environmentNameDraft.value = currentEnvironment?.name || ''
  cloudBaseUrlDraft.value = currentEnvironment?.baseUrl || ''
}

function 构建当前环境草稿(): CloudEnvironment | null {
  const environmentId = selectedEnvironmentId.value
  const name = environmentNameDraft.value.trim()
  const baseUrl = 规范化云端地址(cloudBaseUrlDraft.value)

  if (!environmentId) {
    ElMessage.warning('请先选择云端环境')
    return null
  }
  if (!name || !baseUrl) {
    ElMessage.warning('环境名称和云端地址不能为空')
    return null
  }

  return {
    id: environmentId,
    name,
    baseUrl,
  }
}

function 替换当前环境(nextEnvironment: CloudEnvironment): CloudEnvironment[] {
  return cloudEnvironments.value.map((item) => (item.id === nextEnvironment.id ? nextEnvironment : item))
}

function 应用配置到草稿(config: StudioUiConfig): void {
  selectedEnvironmentId.value = config.activeCloudEnvironmentId
  同步当前环境草稿(config.cloudEnvironments, config.activeCloudEnvironmentId)
}

function 是否默认环境(id: string): boolean {
  return id === 'server' || id === 'local'
}

function 规范化云端地址(value: string): string {
  return value.trim().replace(/\/+$/, '')
}
</script>

<style scoped>
.cloud-account-page {
  min-height: 100%;
  padding: 20px;
  color: var(--studio-text-primary);
}

.header-actions,
.page-grid {
  display: grid;
  gap: 16px;
}

.header-actions {
  display: flex;
}

.page-grid {
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
}

.panel-card {
  border: 1px solid var(--studio-border);
  border-radius: 24px;
  background: var(--studio-card-background);
  box-shadow: var(--studio-shadow);
}

.section-header p {
  margin: 8px 0 0;
  color: var(--studio-text-secondary);
  line-height: 1.6;
}

.panel-card {
  padding: 20px;
}

.sessions-card {
  margin-top: 18px;
}

.section-header,
.form-actions {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.section-header {
  align-items: flex-start;
  margin-bottom: 18px;
}

.section-header h3 {
  margin: 0;
}

.stack-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.environment-toolbar,
.environment-name-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.environment-toolbar :deep(.el-select),
.environment-name-row :deep(.el-input) {
  flex: 1;
}

.environment-actions {
  display: flex;
  gap: 12px;
}

.form-actions {
  flex-wrap: wrap;
}

.inline-alert {
  margin-top: 16px;
}

.profile-block {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.profile-descriptions {
  margin-top: 4px;
}

:deep(.profile-descriptions .el-descriptions__label) {
  width: 128px;
  color: var(--studio-text-secondary);
  background: color-mix(in srgb, var(--studio-card-background) 88%, #000 12%);
}

:deep(.profile-descriptions .el-descriptions__content) {
  color: var(--studio-text-primary);
  background: transparent;
  word-break: break-all;
}

:deep(.profile-descriptions .el-descriptions__table) {
  border-color: var(--studio-border);
}

:deep(.profile-descriptions .el-descriptions__cell) {
  padding-top: 12px;
  padding-bottom: 12px;
}

@media (max-width: 1260px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .cloud-account-page {
    padding: 16px;
  }

  :deep(.profile-descriptions .el-descriptions__label) {
    width: 110px;
  }

  .section-header,
  .form-actions,
  .environment-name-row {
    flex-direction: column;
  }

  .environment-actions {
    flex-direction: column;
  }
}
</style>
