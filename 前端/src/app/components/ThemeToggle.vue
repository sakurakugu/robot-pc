<template>
  <el-dropdown
    trigger="hover"
    placement="bottom-end"
    popper-class="studio-theme-popper"
  >
    <button
      type="button"
      class="theme-trigger"
      @click.stop="toggleTheme"
    >
      <el-icon class="theme-trigger-icon">
        <component :is="currentIcon" />
      </el-icon>
      <span class="theme-trigger-label">{{ currentLabel }}</span>
    </button>

    <template #dropdown>
      <div class="theme-dropdown-content">
        <div class="theme-title">
          主题设置
        </div>

        <div class="theme-options">
          <button
            type="button"
            class="theme-option"
            :class="{ active: !followSystem && theme === 'light' }"
            @click="setTheme('light')"
          >
            <el-icon class="option-icon">
              <Sunny />
            </el-icon>
            <span>日间模式</span>
          </button>

          <button
            type="button"
            class="theme-option"
            :class="{ active: !followSystem && theme === 'dark' }"
            @click="setTheme('dark')"
          >
            <el-icon class="option-icon">
              <MoonNight />
            </el-icon>
            <span>夜间模式</span>
          </button>
        </div>

        <div class="theme-divider" />

        <div class="follow-system-row">
          <span class="follow-system-label">跟随系统</span>
          <el-switch
            :model-value="followSystem"
            @update:model-value="setFollowSystem"
          />
        </div>
      </div>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { MoonNight, Sunny } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme'

const { theme, followSystem, setTheme, setFollowSystem, toggleTheme } = useTheme()

const currentIcon = computed(() => (theme.value === 'dark' ? MoonNight : Sunny))
const currentLabel = computed(() => {
  if (followSystem.value) {
    return theme.value === 'dark' ? '跟随系统·夜间' : '跟随系统·日间'
  }

  return theme.value === 'dark' ? '夜间模式' : '日间模式'
})
</script>

<style scoped>
.theme-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: auto;
  height: 38px;
  padding: 0 10px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--studio-header-text);
  font: inherit;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    color 0.2s ease;
}

.theme-trigger:hover {
  background: transparent;
  color: var(--studio-header-muted);
}

.theme-trigger:active {
  transform: scale(0.98);
}

.theme-trigger-icon {
  flex-shrink: 0;
  font-size: 20px;
}

.theme-trigger-label {
  display: none;
}

.theme-dropdown-content {
  min-width: 188px;
  padding: 10px 12px 12px;
  border-radius: 16px;
  border: 1px solid var(--studio-dropdown-border);
  background: var(--studio-dropdown-background);
  box-shadow: var(--studio-dropdown-shadow);
}

.theme-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  margin-bottom: 12px;
  margin-left: 12px;
  color: var(--studio-text-primary);
  font-size: 18px;
  font-weight: 700;
}

.theme-title::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -12px;
  width: 4px;
  height: 16px;
  border-radius: 999px;
  background: var(--studio-accent);
  transform: translateY(-50%);
}

.theme-options {
  display: flex;
  gap: 8px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 78px;
  padding: 10px 8px;
  border: 1px solid var(--studio-dropdown-option-border);
  border-radius: 10px;
  background: var(--studio-dropdown-option-background);
  color: var(--studio-text-secondary);
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.theme-option:hover {
  border-color: var(--studio-accent);
  color: var(--studio-accent);
}

.theme-option.active {
  border-color: var(--studio-accent);
  background: var(--studio-dropdown-option-active-background);
  color: var(--studio-accent);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.02);
}

.option-icon {
  font-size: 18px;
  color: currentColor;
}

.theme-option span {
  font-size: 12px;
  font-weight: 600;
}

.theme-divider {
  height: 1px;
  margin: 10px 0;
  background: var(--studio-dropdown-border);
}

.follow-system-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--studio-text-primary);
  font-size: 13px;
}

.follow-system-label {
  margin-right: auto;
}

:global(.studio-theme-popper.el-popper) {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

:global(.studio-theme-popper .el-popper__arrow) {
  display: none;
}

@media (max-width: 860px) {
  .theme-trigger {
    padding: 0 12px;
  }
}
</style>
