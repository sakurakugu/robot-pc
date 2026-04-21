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
              保存地址
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
            <div class="profile-head">
              <div class="profile-meta">
                <strong>{{ user.username }}</strong>
                <p>{{ user.nickname || '未设置昵称' }}</p>
              </div>
              <div class="tag-stack">
                <el-tag :type="roleTagType">
                  {{ roleText }}
                </el-tag>
                <el-tag :type="approvalTagType">
                  {{ approvalText }}
                </el-tag>
              </div>
            </div>

            <div class="profile-grid">
              <div class="profile-item">
                <span>邮箱</span>
                <strong>{{ user.email || '-' }}</strong>
              </div>
              <div class="profile-item">
                <span>最近登录</span>
                <strong>{{ formatDateTime(user.lastLoginAt) }}</strong>
              </div>
              <div class="profile-item">
                <span>注册时间</span>
                <strong>{{ formatDateTime(user.createdAt) }}</strong>
              </div>
              <div class="profile-item">
                <span>账号状态</span>
                <strong>{{ user.isActive ? '启用中' : '已停用' }}</strong>
              </div>
            </div>

            <div class="form-actions">
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
  </div>
</template>

<script setup lang="ts">
import { useCloudAccountStore } from '@/features/account/store'
import PageHeader from '@/share/components/PageHeader.vue'
import { RefreshRight, UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const accountStore = useCloudAccountStore()

const activeTab = ref<'login' | 'register'>('login')
const cloudBaseUrlDraft = ref(accountStore.cloudBaseUrl.value)
const savingConfig = ref(false)
const testingConnection = ref(false)
const submittingAuth = ref(false)
const pageLoading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  password: '',
})

const cloudBaseUrl = computed(() => accountStore.cloudBaseUrl.value)
const user = computed(() => accountStore.user.value)
const sessions = computed(() => accountStore.sessions.value)
const registerEnabled = computed(() => accountStore.registerEnabled.value)
const registerApprovalRequired = computed(() => accountStore.registerApprovalRequired.value)
const isAuthenticated = computed(() => accountStore.isAuthenticated.value)
const connectionStatusText = computed(() => accountStore.connectionStatusText.value)
const connectionMessage = computed(() => accountStore.connectionMessage.value)

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

watch(cloudBaseUrl, (value) => {
  cloudBaseUrlDraft.value = value
}, { immediate: true })

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
  savingConfig.value = true
  try {
    const config = await accountStore.saveCloudBaseUrl(cloudBaseUrlDraft.value)
    cloudBaseUrlDraft.value = config.cloudBaseUrl
    ElMessage.success(config.cloudBaseUrl ? '云端地址已保存' : '已清空云端地址')
  } finally {
    savingConfig.value = false
  }
}

async function handleTestConnection(): Promise<void> {
  testingConnection.value = true
  try {
    await accountStore.saveCloudBaseUrl(cloudBaseUrlDraft.value)
    const connected = await accountStore.checkCloudConnection(false)
    if (!connected) {
      return
    }
    ElMessage.success('云端连接正常')
  } finally {
    testingConnection.value = false
  }
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
</script>

<style scoped>
.cloud-account-page {
  min-height: 100%;
  padding: 20px;
  color: var(--studio-text-primary);
}

.header-actions,
.page-grid,
.profile-grid {
  display: grid;
  gap: 16px;
}

.header-actions {
  display: flex;
}

.page-grid {
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
}

.panel-card,
.profile-item {
  border: 1px solid var(--studio-border);
  border-radius: 24px;
  background: var(--studio-card-background);
  box-shadow: var(--studio-shadow);
}

.profile-item span {
  display: block;
  color: var(--studio-text-muted);
  font-size: 13px;
}

.section-header p,
.profile-head p {
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
.form-actions,
.profile-head {
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

.profile-meta strong {
  font-size: 20px;
}

.tag-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-item {
  padding: 16px;
}

.profile-item strong {
  display: block;
  margin-top: 10px;
  line-height: 1.6;
  word-break: break-all;
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

  .profile-grid {
    grid-template-columns: 1fr;
  }

  .section-header,
  .form-actions,
  .profile-head {
    flex-direction: column;
  }
}
</style>
