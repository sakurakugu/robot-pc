<template>
  <el-container class="layout-shell">
    <el-header class="layout-header">
      <div class="header-content">
        <el-icon
          class="logo-icon"
          :size="24"
        >
          <Bot />
        </el-icon>
        <h1>机器狗管理本地</h1>
        <span class="page-title">{{ currentTitle }}</span>
      </div>
      <div class="header-actions">
        <el-button
          class="account-button"
          @click="router.push('/account')"
        >
          <span
            class="account-indicator"
            :class="`is-${accountIndicatorTone}`"
          />
          <span class="account-button-text">{{ accountButtonText }}</span>
        </el-button>
        <ThemeToggle />
      </div>
    </el-header>

    <el-container class="layout-body">
      <el-aside
        class="layout-aside"
        :class="{
          'is-compact': isCompact,
          'is-hidden': isHidden,
        }"
        :width="`${currentAsideWidth}px`"
      >
        <div class="aside-inner">
          <div class="aside-title">
            <span class="aside-title-mark" />
            <span class="aside-title-text">工作站导航</span>
          </div>

          <el-menu
            class="aside-menu"
            :collapse="isCompact"
            :collapse-transition="false"
            :default-active="activeMenu"
            router
          >
            <el-menu-item
              v-for="item in menuItems"
              :key="item.key"
              :index="item.key"
            >
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <template #title>
                {{ item.label }}
              </template>
            </el-menu-item>
          </el-menu>

          <div class="aside-footer">
            <el-button
              text
              class="aside-trigger"
              @click="toggleAside"
            >
              <el-icon class="trigger-icon">
                <component :is="triggerIcon" />
              </el-icon>
              <span class="aside-trigger-text">{{ triggerText }}</span>
            </el-button>
          </div>
        </div>
      </el-aside>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useCloudAccountStore } from '@/features/account/store'
import ThemeToggle from '@/app/components/ThemeToggle.vue'
import { Connection, Expand, Fold, HomeFilled, LocationInformation, UserFilled, VideoPlay } from '@element-plus/icons-vue'
import { Bot } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type AsideMode = 'expanded' | 'compact' | 'hidden'

type MenuItem = {
  key: string
  label: string
  icon: Component
}

const route = useRoute()
const router = useRouter()
const accountStore = useCloudAccountStore()

const asideMode = ref<AsideMode>('expanded')
const autoCompact = ref(false)
const asideWidth = 232
const asideCompactWidth = 72
const asideHiddenWidth = 0
const collapseRatio = 0.2
const expandRatio = 0.18

const menuItems: MenuItem[] = [
  { key: '/', label: '首页', icon: HomeFilled },
  { key: '/account', label: '个人中心', icon: UserFilled },
  { key: '/robots', label: '机器人管理', icon: Connection },
  { key: '/mapping', label: '地图工作台', icon: LocationInformation },
  { key: '/choreo', label: '编舞系统', icon: VideoPlay },
]

const isCompact = computed(() => asideMode.value === 'compact')
const isHidden = computed(() => asideMode.value === 'hidden')
const currentAsideWidth = computed(() => {
  if (asideMode.value === 'hidden') {
    return asideHiddenWidth
  }
  if (asideMode.value === 'compact') {
    return asideCompactWidth
  }
  return asideWidth
})

const triggerIcon = computed(() => (isHidden.value ? Expand : Fold))
const triggerText = computed(() => {
  if (isHidden.value) {
    return '展开侧栏'
  }
  if (isCompact.value) {
    return '继续收起'
  }
  return '收起侧栏'
})

const currentTitle = computed(() => String(route.meta.title || '工作站'))
const accountButtonText = computed(() => {
  if (accountStore.isAuthenticated.value && accountStore.user.value) {
    return `云端：${accountStore.user.value.username}`
  }
  if (accountStore.cloudBaseUrl.value) {
    return `云端：${accountStore.connectionStatusText.value}`
  }
  return '云端未配置'
})
const accountIndicatorTone = computed(() => {
  if (accountStore.isAuthenticated.value) {
    return 'success'
  }
  switch (accountStore.connectionState.value) {
    case 'connected':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

const activeMenu = computed(() => {
  const path = route.path
  const matched = [...menuItems]
    .sort((a, b) => b.key.length - a.key.length)
    .find(item => path === item.key || (item.key !== '/' && path.startsWith(`${item.key}/`)))

  return matched?.key || '/'
})

function toggleAside(): void {
  if (isHidden.value) {
    asideMode.value = window.innerWidth && asideWidth / window.innerWidth >= collapseRatio ? 'compact' : 'expanded'
    autoCompact.value = false
    return
  }

  if (isCompact.value) {
    asideMode.value = 'hidden'
    autoCompact.value = false
    return
  }

  asideMode.value = 'compact'
  autoCompact.value = false
}

function applyAutoCollapse(): void {
  const width = window.innerWidth
  if (!width) {
    return
  }

  const ratio = asideWidth / width
  if (ratio >= collapseRatio) {
    if (asideMode.value === 'expanded') {
      asideMode.value = 'compact'
      autoCompact.value = true
    }
    return
  }

  if (autoCompact.value && ratio <= expandRatio && asideMode.value === 'compact') {
    asideMode.value = 'expanded'
    autoCompact.value = false
  }
}

function handleResize(): void {
  applyAutoCollapse()
}

onMounted(() => {
  applyAutoCollapse()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.layout-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--studio-layout-background);
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 60px;
  padding: 0 22px;
  background: var(--studio-header-background);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: var(--studio-header-shadow);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  color: var(--studio-header-text);
}

.logo-icon {
  font-size: 24px;
}

.layout-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--studio-header-text);
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  min-width: 0;
}

.account-button {
  height: 38px;
  border-radius: 999px;
  border: 1px solid var(--studio-header-control-border);
  background: var(--studio-header-control-background);
  color: var(--studio-text-primary);
  box-shadow: var(--studio-header-control-shadow);
}

.account-button:hover {
  border-color: var(--studio-header-control-hover-border);
  background: var(--studio-header-control-hover-background);
}

.account-button-text {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-indicator {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-right: 8px;
  background: rgba(148, 163, 184, 0.9);
}

.account-indicator.is-success {
  background: #22c55e;
}

.account-indicator.is-warning {
  background: #f59e0b;
}

.account-indicator.is-danger {
  background: #ef4444;
}

.account-indicator.is-info {
  background: rgba(148, 163, 184, 0.9);
}

.page-title {
  color: var(--studio-header-muted);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.layout-body {
  flex: 1;
  min-height: 0;
}

.layout-aside {
  position: relative;
  overflow: hidden;
  transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  border-right: 1px solid var(--studio-border);
  background: var(--studio-aside-background);
  backdrop-filter: blur(14px);
}

.aside-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px 0 10px;
}

.aside-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 16px 24px;
  color: var(--studio-text-primary);
  font-weight: 600;
  white-space: nowrap;
}

.aside-title-mark {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--studio-accent), #22c55e);
  box-shadow: 0 0 0 6px var(--studio-accent-emphasis);
}

.aside-title-text,
.aside-trigger-text {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 0.16s ease,
    transform 0.2s ease;
}

.aside-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

.aside-menu :deep(.el-menu-item) {
  margin: 4px 10px;
  border-radius: 14px;
}

.layout-aside.is-compact .aside-menu :deep(.el-menu-item) {
  margin: 4px 0;
}

.aside-menu :deep(.el-menu-item.is-active) {
  background: var(--studio-menu-active-background);
  color: var(--studio-text-primary);
}

.aside-menu :deep(.el-menu-item:hover) {
  background: var(--studio-menu-hover-background);
}

.aside-footer {
  margin-top: auto;
  padding: 10px 8px 0;
}

.aside-trigger {
  width: 100%;
  justify-content: flex-start;
  color: var(--studio-text-secondary);
}

.aside-trigger:hover {
  color: var(--studio-accent);
}

.trigger-icon {
  font-size: 16px;
}

.layout-main {
  padding: 0;
  overflow: auto;
  min-width: 0;
  min-height: 0;
}

.layout-aside.is-compact .aside-title {
  justify-content: center;
  padding: 0 0 16px 0;
}

.layout-aside.is-compact .aside-title-text {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.layout-aside.is-compact .aside-trigger-text {
  opacity: 0;
  transform: translateX(-8px);
  pointer-events: none;
}

.layout-aside.is-hidden {
  width: 0 !important;
  min-width: 0 !important;
  border-right: none;
  overflow: visible;
  z-index: 1000;
}

.layout-aside.is-hidden .aside-title,
.layout-aside.is-hidden .aside-menu {
  opacity: 0;
  pointer-events: none;
}

.layout-aside.is-hidden .aside-footer {
  position: fixed;
  left: 0;
  bottom: 20px;
  padding: 0;
  z-index: 1000;
}

.layout-aside.is-hidden .aside-trigger {
  width: 58px;
  min-width: 58px;
  height: 38px;
  border-radius: 0 14px 14px 0;
  background: var(--studio-panel-background-strong);
  border: 1px solid var(--studio-border);
  border-left: none;
  box-shadow: var(--studio-shadow);
  justify-content: center;
}

.layout-aside.is-hidden .aside-trigger-text {
  display: none;
}

@media (max-width: 1180px) {
  .layout-header {
    height: auto;
    padding: 16px 18px;
    flex-wrap: wrap;
  }

  .layout-body {
    flex: 1;
  }
}

@media (max-width: 860px) {
  .layout-header h1 {
    font-size: 20px;
  }

  .header-actions {
    margin-left: auto;
  }

  .page-title {
    white-space: normal;
  }
}
</style>
