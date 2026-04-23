<template>
  <div class="app-settings-page">
    <PageHeader
      title="应用设置"
      :icon="Setting"
      @back="goBack"
    />

    <section class="settings-section">
      <div class="section-header">
        <div>
          <h3>外观</h3>
          <p>统一管理主题显示行为。</p>
        </div>
      </div>

      <div class="settings-list">
        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              夜间模式
            </div>
            <div class="setting-description">
              关闭时使用日间模式。启用“跟随系统”后此项仅展示当前状态。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ isDarkMode ? '夜间' : '日间' }}</span>
            <el-switch
              :model-value="isDarkMode"
              :disabled="followSystem"
              @update:model-value="handleDarkModeChange"
            />
          </div>
        </div>

        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              跟随系统
            </div>
            <div class="setting-description">
              开启后自动使用系统当前的明暗主题。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ followSystem ? '已开启' : '已关闭' }}</span>
            <el-switch
              :model-value="followSystem"
              @update:model-value="handleFollowSystemChange"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <div>
          <h3>开发</h3>
          <p>控制开发阶段入口是否在当前应用内展示。</p>
        </div>
      </div>

      <div class="settings-list">
        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              启用开发者设置
            </div>
            <div class="setting-description">
              关闭后会隐藏面向开发阶段的设置入口；首次进入时默认值来自 `.env` 文件。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ developerSettingsEnabled ? '已启用' : '已关闭' }}</span>
            <el-button
              v-if="developerSettingsEnabled"
              text
              @click="router.push('/developer')"
            >
              打开工具
            </el-button>
            <el-switch
              :model-value="developerSettingsEnabled"
              @update:model-value="handleDeveloperSettingsChange"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/share/components/PageHeader.vue'
import { Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppSettings } from '../composables/useAppSettings'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const {
  developerSettingsEnabled,
  setDeveloperSettingsEnabled,
} = useAppSettings()
const { followSystem, setFollowSystem, setTheme, theme } = useTheme()

const isDarkMode = computed(() => theme.value === 'dark')

function goBack(): void {
  router.back()
}

function handleFollowSystemChange(value: boolean): void {
  setFollowSystem(value)
  ElMessage.success(`跟随系统已${value ? '开启' : '关闭'}`)
}

function handleDarkModeChange(value: boolean): void {
  setTheme(value ? 'dark' : 'light')
  ElMessage.success(`已切换为${value ? '夜间模式' : '日间模式'}`)
}

function handleDeveloperSettingsChange(value: boolean): void {
  setDeveloperSettingsEnabled(value)
  ElMessage.success(`开发者设置已${value ? '启用' : '关闭'}`)
}
</script>

<style scoped>
.app-settings-page {
  min-height: 100%;
  padding: 32px;
  background:
    radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.03), transparent 220px),
    var(--el-bg-color-page);
}

.settings-section + .settings-section {
  margin-top: 28px;
}

.section-header {
  margin-bottom: 14px;
}

.section-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--el-text-color-primary);
}

.section-header p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}

.settings-list {
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-bg-color) 94%, white 6%);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
}

.settings-row + .settings-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.setting-main {
  min-width: 0;
}

.setting-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.setting-description {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.setting-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  flex-shrink: 0;
}

.setting-value {
  min-width: 52px;
  color: var(--el-text-color-secondary);
  text-align: right;
}

@media (max-width: 900px) {
  .app-settings-page {
    padding: 20px;
  }

  .settings-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-side {
    width: 100%;
    justify-content: space-between;
  }

  .setting-value {
    text-align: left;
  }
}
</style>
