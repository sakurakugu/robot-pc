<template>
  <div class="studio-home">
    <section class="home-hero">
      <div class="hero-copy">
        <p class="hero-kicker">
          Robot Studio
        </p>
        <h1>电脑端工作站</h1>
        <p>
          把重交互、本地直连和专业工作流留在电脑端。当前优先落地编舞与地图调试，后面继续并入导航、雷达和日志分析。
        </p>
      </div>
      <div class="hero-side">
        <div class="hero-stat">
          <span>模块</span>
          <strong>2</strong>
        </div>
        <div class="hero-stat">
          <span>架构</span>
          <strong>本地优先</strong>
        </div>
      </div>
    </section>

    <section class="module-grid">
      <button
        type="button"
        class="module-card module-card-robot"
        @click="router.push('/robots')"
      >
        <div class="module-icon">
          <el-icon><Cpu /></el-icon>
        </div>
        <p class="module-tag">
          机器人接入
        </p>
        <h2>维护机器人配置并生成工作站接入地址</h2>
        <p class="module-desc">
          统一管理机器人 IP、robot-server 地址和 robot-agent 业务通道接入方式。
        </p>
      </button>

      <button
        type="button"
        class="module-card module-card-mapping"
        @click="router.push('/mapping')"
      >
        <div class="module-icon">
          <el-icon><LocationInformation /></el-icon>
        </div>
        <p class="module-tag">
          地图工作台
        </p>
        <h2>查看地图、位姿与建图过程桩状态</h2>
        <p class="module-desc">
          读取本地地图目录，叠加机器人当前位置和目标点，先提供工作站侧本地命令流。
        </p>
      </button>

      <button
        type="button"
        class="module-card module-card-choreo"
        @click="router.push('/choreo')"
      >
        <div class="module-icon">
          <el-icon><VideoPlay /></el-icon>
        </div>
        <p class="module-tag">
          编舞系统
        </p>
        <h2>编排动作、音频与执行流程</h2>
        <p class="module-desc">
          已迁入电脑端，适合作为本地高频创作与调试入口。
        </p>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Cpu, LocationInformation, VideoPlay } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.studio-home {
  min-height: 100%;
  padding: 36px;
  background:
    radial-gradient(circle at top left, rgba(250, 204, 21, 0.18), transparent 26%),
    radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.16), transparent 28%),
    linear-gradient(180deg, #0a111b 0%, #101a28 100%);
  color: #eef4ff;
}

.home-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 34px;
  border-radius: 32px;
  background: linear-gradient(135deg, rgba(17, 24, 39, 0.92), rgba(12, 18, 29, 0.74));
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 24px 54px rgba(0, 0, 0, 0.28);
}

.hero-kicker {
  margin: 0 0 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: #facc15;
}

.hero-copy h1 {
  margin: 0;
  font-size: 42px;
}

.hero-copy p:last-child {
  max-width: 760px;
  margin: 16px 0 0;
  color: rgba(226, 232, 240, 0.74);
  line-height: 1.8;
}

.hero-side {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.hero-stat {
  min-width: 150px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.hero-stat span {
  display: block;
  color: rgba(226, 232, 240, 0.66);
  font-size: 13px;
}

.hero-stat strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-top: 24px;
}

.module-card {
  padding: 28px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
}

.module-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.24);
}

.module-card-mapping {
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 24%),
    linear-gradient(180deg, rgba(7, 18, 31, 0.96), rgba(10, 28, 44, 0.9));
}

.module-card-robot {
  background:
    radial-gradient(circle at top center, rgba(34, 197, 94, 0.14), transparent 24%),
    linear-gradient(180deg, rgba(8, 28, 24, 0.96), rgba(12, 42, 32, 0.9));
}

.module-card-choreo {
  background:
    radial-gradient(circle at top left, rgba(249, 115, 22, 0.18), transparent 24%),
    linear-gradient(180deg, rgba(27, 12, 18, 0.96), rgba(45, 20, 20, 0.9));
}

.module-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 24px;
}

.module-tag {
  margin: 18px 0 10px;
  color: rgba(226, 232, 240, 0.66);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
}

.module-card h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.25;
}

.module-desc {
  margin: 16px 0 0;
  color: rgba(226, 232, 240, 0.72);
  line-height: 1.7;
}

@media (max-width: 980px) {
  .studio-home {
    padding: 18px;
  }

  .home-hero,
  .hero-side,
  .module-grid {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
