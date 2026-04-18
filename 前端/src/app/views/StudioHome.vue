<template>
  <div class="studio-home-page">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="hero-kicker">
          Robot Studio / 首页
        </p>
        <h2>把工作站入口收敛到一个控制台里</h2>
        <p class="hero-description">
          电脑端优先承担本地高频操作：先配机器人接入，再进地图工作台做联调，最后在编舞系统里完成创作和执行。
        </p>

        <div class="hero-actions">
          <el-button
            type="primary"
            size="large"
            @click="router.push('/robots')"
          >
            进入机器人接入
          </el-button>
          <el-button
            size="large"
            @click="router.push('/mapping')"
          >
            打开地图工作台
          </el-button>
          <el-button
            size="large"
            @click="router.push('/choreo')"
          >
            进入编舞系统
          </el-button>
        </div>
      </div>

      <div class="hero-summary">
        <div class="summary-card summary-card-primary">
          <span>接入链路</span>
          <strong>robot-server / robot-agent</strong>
          <p>统一维护机器人资料与工作站业务地址。</p>
        </div>
        <div class="summary-card">
          <span>地图调试</span>
          <strong>本地地图 + 真机遥测</strong>
          <p>直接在电脑端看地图、位姿和命令结果。</p>
        </div>
        <div class="summary-card">
          <span>创作执行</span>
          <strong>编舞系统已迁入</strong>
          <p>适合作为大屏高频编辑和回放入口。</p>
        </div>
      </div>
    </section>

    <section class="entry-grid">
      <button
        v-for="entry in entries"
        :key="entry.title"
        type="button"
        class="entry-card"
        @click="router.push(entry.path)"
      >
        <div class="entry-top">
          <div class="entry-icon">
            <el-icon>
              <component :is="entry.icon" />
            </el-icon>
          </div>
          <el-tag
            size="small"
            :type="entry.tagType"
            effect="plain"
          >
            {{ entry.tag }}
          </el-tag>
        </div>

        <h3>{{ entry.title }}</h3>
        <p class="entry-description">
          {{ entry.description }}
        </p>

        <div class="entry-footer">
          <span>{{ entry.footer }}</span>
          <el-icon><ArrowRight /></el-icon>
        </div>
      </button>
    </section>

    <section class="workflow-panel">
      <div class="workflow-header">
        <div>
          <p class="section-kicker">
            推荐流程
          </p>
          <h3>按这个顺序用，调试链路会更顺</h3>
        </div>
        <el-tag type="info">
          工作站主线
        </el-tag>
      </div>

      <div class="workflow-grid">
        <div
          v-for="step in workflow"
          :key="step.index"
          class="workflow-card"
        >
          <span class="workflow-index">0{{ step.index }}</span>
          <strong>{{ step.title }}</strong>
          <p>{{ step.description }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight, Connection, LocationInformation, Monitor, VideoPlay } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'

type EntryCard = {
  title: string
  description: string
  footer: string
  path: string
  tag: string
  tagType: 'primary' | 'success' | 'warning'
  icon: Component
}

const router = useRouter()

const entries: EntryCard[] = [
  {
    title: '机器人接入',
    description: '维护机器人 IP、robot-server 地址和工作站业务通道模板，先把接入面收敛干净。',
    footer: '适合先做配置与诊断',
    path: '/robots',
    tag: '基础配置',
    tagType: 'primary',
    icon: Connection,
  },
  {
    title: '地图工作台',
    description: '读取本地地图目录，叠加真机遥测和目标位姿，适合做建图、定位和链路联调。',
    footer: '适合联调真机状态',
    path: '/mapping',
    tag: '调试入口',
    tagType: 'success',
    icon: LocationInformation,
  },
  {
    title: '编舞系统',
    description: '在电脑端完成大屏创作、动作编排和执行控制，保留专业工作流的操作密度。',
    footer: '适合高频创作与执行',
    path: '/choreo',
    tag: '核心能力',
    tagType: 'warning',
    icon: VideoPlay,
  },
  {
    title: '工作站定位',
    description: '当前电脑端重点承接本地优先能力，不继续把高交互调试流程塞回云端页面。',
    footer: '和云端分工更清晰',
    path: '/robots',
    tag: '产品边界',
    tagType: 'primary',
    icon: Monitor,
  },
]

const workflow = [
  {
    index: 1,
    title: '先维护接入',
    description: '先确认机器人资料、接入地址和工作站诊断都正常，再进入后续调试页面。',
  },
  {
    index: 2,
    title: '再看地图状态',
    description: '地图工作台用于核对地图目录、位姿叠加、真机遥测和命令回路是否通顺。',
  },
  {
    index: 3,
    title: '最后做创作执行',
    description: '编舞系统适合在大屏环境下完成高频编辑、回放和正式执行。',
  },
]
</script>

<style scoped>
.studio-home-page {
  min-height: 100%;
  padding: 24px;
  color: #0f172a;
}

.hero-panel,
.workflow-panel,
.entry-card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
  gap: 18px;
  padding: 26px;
  border-radius: 28px;
}

.hero-kicker,
.section-kicker {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0369a1;
}

.hero-copy h2,
.workflow-header h3 {
  margin: 0;
}

.hero-copy h2 {
  font-size: 38px;
  line-height: 1.15;
}

.hero-description {
  max-width: 780px;
  margin: 16px 0 0;
  color: #475569;
  line-height: 1.8;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

.hero-summary {
  display: grid;
  gap: 12px;
}

.summary-card {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.92));
}

.summary-card-primary {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 28%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(224, 242, 254, 0.92));
}

.summary-card span {
  display: block;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0369a1;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
}

.summary-card p {
  margin: 10px 0 0;
  color: #475569;
  line-height: 1.6;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.entry-card {
  padding: 20px;
  border-radius: 24px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.entry-card:hover {
  transform: translateY(-4px);
  border-color: rgba(14, 165, 233, 0.4);
  box-shadow: 0 24px 48px rgba(14, 165, 233, 0.1);
}

.entry-top,
.entry-footer,
.workflow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.entry-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(34, 197, 94, 0.1));
  color: #0f172a;
  font-size: 24px;
}

.entry-card h3 {
  margin: 18px 0 0;
  font-size: 22px;
  line-height: 1.25;
}

.entry-description {
  margin: 14px 0 0;
  color: #475569;
  line-height: 1.7;
  min-height: 96px;
}

.entry-footer {
  margin-top: 18px;
  color: #0369a1;
  font-weight: 600;
}

.workflow-panel {
  margin-top: 18px;
  padding: 24px;
  border-radius: 28px;
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.workflow-card {
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.9));
}

.workflow-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
}

.workflow-card strong {
  display: block;
  margin-top: 14px;
  font-size: 18px;
}

.workflow-card p {
  margin: 10px 0 0;
  color: #475569;
  line-height: 1.7;
}

@media (max-width: 1380px) {
  .entry-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1120px) {
  .hero-panel,
  .workflow-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .studio-home-page {
    padding: 16px;
  }

  .entry-grid {
    grid-template-columns: 1fr;
  }

  .hero-copy h2 {
    font-size: 30px;
  }

  .workflow-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
