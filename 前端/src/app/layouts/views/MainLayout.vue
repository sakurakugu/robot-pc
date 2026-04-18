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
        <h1>机器狗电脑端工作站</h1>
        <el-button
          text
          class="home-btn"
          @click="goHome"
        >
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-button>
      </div>
      <div class="header-actions">
        <span class="page-title">{{ currentTitle }}</span>
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
import { Connection, Expand, Fold, HomeFilled, LocationInformation, VideoPlay } from '@element-plus/icons-vue'
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

const asideMode = ref<AsideMode>('expanded')
const autoCompact = ref(false)
const asideWidth = 232
const asideCompactWidth = 72
const asideHiddenWidth = 0
const collapseRatio = 0.2
const expandRatio = 0.18

const menuItems: MenuItem[] = [
  { key: '/', label: '首页', icon: HomeFilled },
  { key: '/robots', label: '机器人接入', icon: Connection },
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

function goHome(): void {
  router.push('/')
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
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 22%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.1), transparent 24%),
    linear-gradient(180deg, #f5f8fc 0%, #eef3f9 100%);
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 60px;
  padding: 0 22px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  color: #fff;
}

.logo-icon {
  font-size: 24px;
}

.layout-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.home-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.home-btn:hover {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

.header-actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.page-title {
  color: rgba(255, 255, 255, 0.92);
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
  border-right: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.92));
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
  color: #0f172a;
  font-weight: 600;
  white-space: nowrap;
}

.aside-title-mark {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: linear-gradient(135deg, #0ea5e9, #22c55e);
  box-shadow: 0 0 0 6px rgba(14, 165, 233, 0.12);
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

.aside-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(34, 197, 94, 0.12));
  color: #0f172a;
}

.aside-menu :deep(.el-menu-item:hover) {
  background: rgba(148, 163, 184, 0.12);
}

.aside-footer {
  margin-top: auto;
  padding: 10px 8px 0;
}

.aside-trigger {
  width: 100%;
  justify-content: flex-start;
  color: #334155;
}

.aside-trigger:hover {
  color: #0369a1;
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

.layout-aside.is-compact .aside-title-text,
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
  z-index: 30;
}

.layout-aside.is-hidden .aside-trigger {
  width: 58px;
  min-width: 58px;
  height: 38px;
  border-radius: 0 14px 14px 0;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-left: none;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
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
    width: 100%;
  }

  .page-title {
    white-space: normal;
  }
}
</style>
