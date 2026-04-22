<template>
  <div class="robot-management">
    <PageHeader
      title="机器狗管理"
      :icon="Bot"
      @back="router.push('/')"
    >
      <template #extra>
        <div class="header-actions">
          <el-button
            :icon="RefreshRight"
            :loading="loading"
            @click="refreshRobots"
          >
            刷新
          </el-button>
          <el-button
            type="primary"
            :icon="Plus"
            @click="openCreateDialog"
          >
            新增机器狗
          </el-button>
        </div>
      </template>
    </PageHeader>

    <section class="overview-panel">
      <div class="overview-grid">
        <div class="overview-item">
          <el-tooltip
            content="本地工作站当前维护的全部机器狗记录"
            placement="top"
          >
            <article class="overview-card accent">
              <span>机器狗总数</span>
              <strong>{{ robots.length }}</strong>
            </article>
          </el-tooltip>
        </div>
        <div class="overview-item">
          <el-tooltip
            content="已连接到工作站业务通道或处于在线状态"
            placement="top"
          >
            <article class="overview-card">
              <span>在线机器狗</span>
              <strong>{{ onlineCount }}</strong>
            </article>
          </el-tooltip>
        </div>
        <div class="overview-item">
          <el-tooltip
            content="按手机端相同的分组概念管理机器狗"
            placement="top"
          >
            <article class="overview-card">
              <span>分组数量</span>
              <strong>{{ groupOptions.length }}</strong>
            </article>
          </el-tooltip>
        </div>
        <div class="overview-item">
          <el-tooltip
            content="缺少 IP 与 robot-server 地址的记录"
            placement="top"
          >
            <article class="overview-card">
              <span>待补接入</span>
              <strong>{{ pendingAccessCount }}</strong>
            </article>
          </el-tooltip>
        </div>
      </div>

      <div class="toolbar-row">
        <el-input
          v-model="keyword"
          clearable
          class="keyword-input"
          placeholder="搜索名称、UUID、IP、型号、标签"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="groupFilter"
          clearable
          filterable
          class="group-select"
          placeholder="筛选分组"
        >
          <el-option
            v-for="group in groupOptions"
            :key="group"
            :label="group"
            :value="group"
          />
        </el-select>
      </div>
      <div class="toolbar-summary">
        <span>当前展示 {{ filteredRobots.length }} / {{ robots.length }} 台</span>
        <span v-if="groupFilter">分组：{{ groupFilter }}</span>
        <span v-if="keyword">关键词：{{ keyword }}</span>
      </div>
    </section>

    <section
      v-if="robots.length === 0"
      class="empty-panel"
    >
      <el-empty description="还没有机器狗记录">
        <template #description>
          <div class="empty-description">
            <p>新增流程已对齐手机端。</p>
            <p>可以直接做 mDNS 扫描、手动新增，或者从云端拉取到本地。</p>
          </div>
        </template>
        <el-button
          type="primary"
          @click="openCreateDialog"
        >
          新增机器狗
        </el-button>
      </el-empty>
    </section>

    <section
      v-else-if="filteredRobots.length === 0"
      class="empty-panel"
    >
      <el-empty description="没有符合筛选条件的机器狗" />
    </section>

    <section
      v-else
      class="robot-grid"
    >
      <article
        v-for="robot in filteredRobots"
        :key="robot.uuid"
        class="robot-card"
        @click="openDetail(robot)"
      >
        <div class="robot-card-top">
          <div class="robot-title-block">
            <div class="robot-title-row">
              <strong>{{ robot.name || robot.uuid }}</strong>
              <el-tag :type="statusTagTypeMap[robot.status]">
                {{ statusLabelMap[robot.status] }}
              </el-tag>
            </div>
            <p class="robot-uuid">
              {{ robot.uuid }}
            </p>
          </div>
        </div>

        <div class="robot-summary-list">
          <div class="summary-row">
            <span>型号</span>
            <strong>{{ robot.model || '-' }}</strong>
          </div>
          <div class="summary-row">
            <span>分组</span>
            <strong>{{ robot.group_name || '-' }}</strong>
          </div>
          <div class="summary-row">
            <span>IP</span>
            <strong>{{ robot.ip || '-' }}</strong>
          </div>
          <div class="summary-row">
            <span>SN</span>
            <strong>{{ robot.sn || '-' }}</strong>
          </div>
          <div class="summary-row">
            <span>robot-server</span>
            <strong>{{ robot.serverUrl || 自动推导服务地址(robot) || '-' }}</strong>
          </div>
        </div>

        <div class="tag-row">
          <el-tag
            v-if="robot.tags.length === 0"
            size="small"
            type="info"
            effect="plain"
          >
            无标签
          </el-tag>
          <el-tag
            v-for="tag in robot.tags"
            :key="tag"
            size="small"
            effect="plain"
          >
            {{ tag }}
          </el-tag>
        </div>

        <div class="robot-card-actions">
          <el-button
            size="small"
            @click.stop="openDetail(robot)"
          >
            接入详情
          </el-button>
          <el-button
            size="small"
            @click.stop="openEditDialog(robot)"
          >
            编辑
          </el-button>
          <el-button
            size="small"
            type="danger"
            plain
            @click.stop="handleDelete(robot)"
          >
            删除
          </el-button>
        </div>
      </article>
    </section>

    <el-drawer
      v-model="detailVisible"
      size="720px"
      destroy-on-close
      :title="currentDetailRobot ? `${currentDetailRobot.name || currentDetailRobot.uuid} · 接入详情` : '接入详情'"
    >
      <template v-if="currentDetailRobot">
        <div class="detail-stack">
          <section class="detail-hero">
            <div>
              <h3>{{ currentDetailRobot.name || currentDetailRobot.uuid }}</h3>
              <p>{{ currentDetailRobot.uuid }}</p>
            </div>
            <div class="detail-hero-actions">
              <el-button @click="openEditDialog(currentDetailRobot)">
                编辑
              </el-button>
              <el-button
                :icon="RefreshRight"
                :loading="diagnosisLoading"
                @click="refreshCurrentDiagnosis"
              >
                重新诊断
              </el-button>
            </div>
          </section>

          <section class="detail-info-grid">
            <div class="detail-info-item">
              <span>状态</span>
              <strong>{{ statusLabelMap[currentDetailRobot.status] }}</strong>
            </div>
            <div class="detail-info-item">
              <span>型号</span>
              <strong>{{ currentDetailRobot.model || '-' }}</strong>
            </div>
            <div class="detail-info-item">
              <span>分组</span>
              <strong>{{ currentDetailRobot.group_name || '-' }}</strong>
            </div>
            <div class="detail-info-item">
              <span>IP</span>
              <strong>{{ currentDetailRobot.ip || '-' }}</strong>
            </div>
            <div class="detail-info-item">
              <span>SN</span>
              <strong>{{ currentDetailRobot.sn || '-' }}</strong>
            </div>
            <div class="detail-info-item">
              <span>robot-server</span>
              <strong>{{ currentDetailRobot.serverUrl || 自动推导服务地址(currentDetailRobot) || '-' }}</strong>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-header">
              <div>
                <h3>标签</h3>
                <p>沿用手机端的轻量标签能力，方便快速筛选和识别。</p>
              </div>
            </div>
            <div class="tag-row">
              <el-tag
                v-if="currentDetailRobot.tags.length === 0"
                type="info"
                effect="plain"
              >
                无标签
              </el-tag>
              <el-tag
                v-for="tag in currentDetailRobot.tags"
                :key="tag"
                effect="plain"
              >
                {{ tag }}
              </el-tag>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-header section-header-with-action">
              <div>
                <h3>连接诊断</h3>
                <p>保留电脑端原有接入能力，但改成详情级信息，不再占据主页面。</p>
              </div>
              <span
                v-if="diagnosis"
                class="section-caption"
              >
                最近检测 {{ formatDateTime(diagnosis.checkedAt) }}
              </span>
            </div>

            <div
              v-if="diagnosisLoading && !diagnosis"
              class="loading-panel"
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
              <article
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
              </article>
            </div>

            <div
              v-else
              class="empty-inline"
            >
              <el-empty description="尚未获取诊断结果" />
            </div>
          </section>

          <section class="detail-section">
            <div class="section-header">
              <div>
                <h3>工作站接入地址</h3>
                <p>把机器狗业务通道地址改成以下任一地址即可连接到当前工作站。</p>
              </div>
            </div>

            <div
              v-if="accessCandidates.length === 0"
              class="empty-inline"
            >
              <el-empty description="暂无可用接入地址" />
            </div>

            <div
              v-else
              class="candidate-list"
            >
              <article
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
              </article>
            </div>
          </section>

          <section class="detail-section">
            <div class="section-header">
              <div>
                <h3>配置建议</h3>
                <p>把电脑端特有的接入信息收口到这里，避免来回翻文档。</p>
              </div>
            </div>
            <div class="guide-grid">
              <article class="guide-card">
                <span>业务通道</span>
                <code>{{ buildBusinessUrl(accessCandidates[0]) || '-' }}</code>
              </article>
              <article class="guide-card">
                <span>robot-server</span>
                <code>{{ currentDetailRobot.serverUrl || 自动推导服务地址(currentDetailRobot) || '-' }}</code>
              </article>
              <article class="guide-card">
                <span>地图工作台联动</span>
                <p>保存后即可在地图工作台或编舞系统直接选择这台机器狗。</p>
              </article>
            </div>
          </section>
        </div>
      </template>
    </el-drawer>

    <el-dialog
      v-model="createDialogVisible"
      title="新增机器狗"
      width="860px"
      @closed="handleCreateDialogClosed"
    >
      <div class="create-dialog-stack">
        <p class="create-section-description">
          电脑端新增流程已对齐手机端：支持 mDNS 扫描、手动新增，并补充从云端拉取到本地。
        </p>

        <el-tabs v-model="createTab">
          <el-tab-pane
            label="mDNS 扫描"
            name="mdns"
          >
            <div class="create-tab-stack">
              <div class="create-toolbar">
                <div>
                  <strong>自动发现局域网机器人</strong>
                  <p>扫描 `_sparkrobot._tcp.` 服务，并自动同步本地已存在机器人的基础信息。</p>
                </div>
                <el-button
                  type="primary"
                  :loading="discoveryLoading"
                  @click="handleDiscoverRobots"
                >
                  {{ discoveryLoading ? '扫描中...' : '开始扫描' }}
                </el-button>
              </div>

              <el-alert
                v-if="discoveryMessage"
                :title="discoveryMessage"
                :type="discoveryMessageType"
                show-icon
                :closable="false"
              />

              <div
                v-if="newlyDiscovered.length > 0"
                class="discovery-list"
              >
                <article
                  v-for="robot in newlyDiscovered"
                  :key="robot.uuid"
                  class="discovery-card"
                  :class="{ selected: selectedDiscoveredRobotId === robot.uuid }"
                  @click="selectedDiscoveredRobotId = robot.uuid"
                >
                  <div class="discovery-row">
                    <div class="discovery-main">
                      <strong>{{ robot.name }}</strong>
                      <p>
                        {{ robot.model || '未提供型号' }} · {{ robot.version || '未提供版本' }}
                      </p>
                    </div>
                    <el-tag type="success">
                      {{ robot.ip }}:{{ robot.port }}
                    </el-tag>
                  </div>
                  <p class="robot-uuid">
                    {{ robot.uuid }}
                  </p>
                </article>
              </div>

              <el-empty
                v-else-if="discoveryHasScanned && discoveredRobots.length === 0"
                description="未发现机器人"
              />
              <el-empty
                v-else-if="discoveryHasScanned"
                description="扫描到的机器人都已经在本地"
              />

              <div
                v-if="alreadyDiscovered.length > 0"
                class="existing-section"
              >
                <el-button
                  text
                  @click="existingDiscoveredCollapsed = !existingDiscoveredCollapsed"
                >
                  {{ existingDiscoveredCollapsed ? `已在本地 ${alreadyDiscovered.length} 台，点击展开` : `已在本地 ${alreadyDiscovered.length} 台，点击收起` }}
                </el-button>
                <div
                  v-if="!existingDiscoveredCollapsed"
                  class="discovery-list"
                >
                  <article
                    v-for="robot in alreadyDiscovered"
                    :key="robot.uuid"
                    class="discovery-card existing"
                  >
                    <div class="discovery-row">
                      <div class="discovery-main">
                        <strong>{{ robot.name }}</strong>
                        <p>
                          {{ robot.model || '未提供型号' }} · {{ robot.version || '未提供版本' }}
                        </p>
                      </div>
                      <el-tag type="info">
                        {{ robot.ip }}:{{ robot.port }}
                      </el-tag>
                    </div>
                    <p class="robot-uuid">
                      {{ robot.uuid }}
                    </p>
                  </article>
                </div>
              </div>

              <div class="inline-form-row">
                <el-input
                  v-model="discoveryGroupName"
                  placeholder="分组，例如：Default"
                />
                <el-button
                  type="primary"
                  :disabled="!selectedDiscoveredRobot"
                  @click="handleAddDiscoveredRobot"
                >
                  添加已发现的机器人
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane
            label="手动新增"
            name="manual"
          >
            <div class="create-tab-stack">
              <div class="create-toolbar">
                <div>
                  <strong>按手机端相同字段手动新增</strong>
                  <p>只需要名称、机器人 IP、分组，其他字段后续可在编辑里补充。</p>
                </div>
              </div>

              <el-form
                label-width="84px"
                class="simple-form"
              >
                <el-form-item
                  label="名称"
                  required
                >
                  <el-input
                    v-model="manualForm.name"
                    placeholder="例如：机器狗1"
                  />
                </el-form-item>
                <el-form-item label="机器人 IP">
                  <el-input
                    v-model="manualForm.ip"
                    placeholder="例如：192.168.1.110"
                  />
                </el-form-item>
                <el-form-item label="分组">
                  <el-input
                    v-model="manualForm.group_name"
                    placeholder="例如：Default"
                  />
                </el-form-item>
              </el-form>

              <div class="create-footer">
                <el-button
                  type="primary"
                  :loading="manualSaving"
                  @click="handleManualAddRobot"
                >
                  保存到本地
                </el-button>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane
            label="云端拉取"
            name="cloud"
          >
            <div class="create-tab-stack">
              <template v-if="cloudImportAvailable">
                <div class="create-toolbar">
                  <div>
                    <strong>从当前云端环境拉取机器人</strong>
                    <p>使用电脑端当前登录的云端账号，把机器人资料同步到本地工作站。</p>
                  </div>
                  <el-button
                    :loading="cloudLoading"
                    @click="loadCloudRobots"
                  >
                    {{ cloudLoading ? '加载中...' : '刷新云端列表' }}
                  </el-button>
                </div>

                <div class="inline-form-row">
                  <el-input
                    v-model="cloudGroupName"
                    placeholder="可选：导入后统一覆盖为某个分组"
                  />
                  <el-button
                    type="primary"
                    :loading="cloudSyncing"
                    :disabled="selectedCloudRobotIds.length === 0"
                    @click="handleImportSelectedCloudRobots"
                  >
                    导入选中 {{ selectedCloudRobotIds.length > 0 ? `(${selectedCloudRobotIds.length})` : '' }}
                  </el-button>
                </div>

                <div class="toolbar-summary">
                  <span>云端列表 {{ cloudRobots.length }} 台</span>
                  <span v-if="cloudLastLoadedAt">最近加载：{{ formatDateTime(cloudLastLoadedAt) }}</span>
                </div>

                <el-alert
                  v-if="cloudMessage"
                  :title="cloudMessage"
                  :type="cloudMessageType"
                  show-icon
                  :closable="false"
                />

                <el-table
                  v-loading="cloudLoading"
                  :data="cloudRobots"
                  row-key="uuid"
                  max-height="360"
                  @selection-change="handleCloudSelectionChange"
                >
                  <el-table-column
                    type="selection"
                    width="48"
                  />
                  <el-table-column
                    label="名称"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      <div class="table-main-cell">
                        <strong>{{ row.name || row.uuid }}</strong>
                        <span>{{ row.uuid }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="型号"
                    min-width="120"
                  >
                    <template #default="{ row }">
                      {{ row.model || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="局域网地址"
                    min-width="150"
                  >
                    <template #default="{ row }">
                      {{ 获取云端机器人局域网IP(row) || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="分组"
                    min-width="120"
                  >
                    <template #default="{ row }">
                      {{ row.group_name || '-' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="本地状态"
                    width="100"
                  >
                    <template #default="{ row }">
                      <el-tag :type="existingRobotMap.has(row.uuid) ? 'warning' : 'success'">
                        {{ existingRobotMap.has(row.uuid) ? '已存在' : '未导入' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="操作"
                    width="100"
                    fixed="right"
                  >
                    <template #default="{ row }">
                      <el-button
                        link
                        type="primary"
                        @click="handleImportSingleCloudRobot(row)"
                      >
                        {{ existingRobotMap.has(row.uuid) ? '同步' : '导入' }}
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>

                <el-empty
                  v-if="!cloudLoading && cloudRobots.length === 0"
                  description="当前云端暂无机器人"
                />
              </template>

              <template v-else>
                <el-empty description="请先在个人中心配置云端地址并登录账号">
                  <el-button
                    type="primary"
                    @click="router.push('/account')"
                  >
                    前往个人中心
                  </el-button>
                </el-empty>
              </template>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <template #footer>
        <el-button @click="createDialogVisible = false">
          关闭
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dialogVisible"
      title="编辑机器狗"
      width="620px"
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="96px"
      >
        <el-form-item
          label="UUID"
          prop="uuid"
        >
          <el-input
            v-model="form.uuid"
            disabled
          />
        </el-form-item>
        <el-form-item
          label="名称"
          prop="name"
        >
          <el-input
            v-model="form.name"
            placeholder="例如 客厅巡逻狗"
          />
        </el-form-item>
        <el-form-item label="型号">
          <el-input
            v-model="form.model"
            placeholder="例如 Unitree Go2"
          />
        </el-form-item>
        <el-form-item label="IP">
          <el-input
            v-model="form.ip"
            placeholder="例如 192.168.1.120"
          />
        </el-form-item>
        <el-form-item label="分组">
          <el-input
            v-model="form.group_name"
            placeholder="例如 Default"
          />
        </el-form-item>
        <el-form-item label="SN">
          <el-input
            v-model="form.sn"
            placeholder="例如 GO2-001"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-input
            v-model="tagsText"
            placeholder="多个标签用逗号分隔"
          />
        </el-form-item>
        <el-form-item label="server 地址">
          <el-input
            v-model="form.serverUrl"
            placeholder="留空时按 http://IP:8080 推导"
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
import PageHeader from '@/share/components/PageHeader.vue'
import { useCloudAccountStore } from '@/features/account/store'
import { Plus, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { v7 as uuidv7 } from 'uuid'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  deleteRobot,
  discoverLocalRobots,
  fetchCloudRobotList,
  getRobotAccessInfo,
  getRobotDiagnosis,
  getRobotList,
  saveRobot,
} from '../api'
import type {
  CloudRobotRecord,
  DiscoveredRobot,
  Robot,
  RobotConnectionDiagnosis,
  RobotDiagnosticProbe,
  SaveRobotPayload,
  StudioAccessCandidate,
} from '../types'

const router = useRouter()
const accountStore = useCloudAccountStore()
const robots = ref<Robot[]>([])
const loading = ref(false)
const detailVisible = ref(false)
const detailRobotId = ref('')
const accessCandidates = ref<StudioAccessCandidate[]>([])
const diagnosis = ref<RobotConnectionDiagnosis | null>(null)
const diagnosisLoading = ref(false)
const createDialogVisible = ref(false)
const createTab = ref('mdns')
const discoveryLoading = ref(false)
const discoveryHasScanned = ref(false)
const discoveryMessage = ref('')
const discoveryMessageType = ref<'success' | 'info' | 'warning' | 'error'>('info')
const discoveredRobots = ref<DiscoveredRobot[]>([])
const selectedDiscoveredRobotId = ref('')
const discoveryGroupName = ref('')
const existingDiscoveredCollapsed = ref(true)
const manualSaving = ref(false)
const cloudLoading = ref(false)
const cloudSyncing = ref(false)
const cloudRobots = ref<CloudRobotRecord[]>([])
const selectedCloudRobotIds = ref<string[]>([])
const cloudGroupName = ref('')
const cloudMessage = ref('')
const cloudMessageType = ref<'success' | 'info' | 'warning' | 'error'>('info')
const cloudLastLoadedAt = ref('')
const dialogVisible = ref(false)
const saving = ref(false)
const editingRobot = ref<Robot | null>(null)
const keyword = ref('')
const groupFilter = ref('')
const tagsText = ref('')
const formRef = ref<FormInstance>()
let diagnosisRequestId = 0

const manualForm = reactive({
  name: '',
  ip: '',
  group_name: '',
})

const form = reactive<SaveRobotPayload>({
  uuid: '',
  name: '',
  model: '',
  ip: '',
  group_name: '',
  tags: [],
  sn: '',
  serverUrl: '',
})

const rules: FormRules<SaveRobotPayload> = {
  name: [{ required: true, message: '请输入机器狗名称', trigger: 'blur' }],
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

const existingRobotMap = computed(() => new Map(robots.value.map((robot) => [robot.uuid, robot])))

const groupOptions = computed(() => {
  const groups = new Set<string>()
  for (const robot of robots.value) {
    if (robot.group_name) {
      groups.add(robot.group_name)
    }
  }
  return Array.from(groups).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

const filteredRobots = computed(() => {
  return [...robots.value]
    .filter((robot) => {
      if (groupFilter.value && robot.group_name !== groupFilter.value) {
        return false
      }
      if (!normalizedKeyword.value) {
        return true
      }
      const matchedFields = [
        robot.uuid,
        robot.name || '',
        robot.model || '',
        robot.ip || '',
        robot.group_name || '',
        robot.sn || '',
        robot.serverUrl || '',
        ...(robot.tags || []),
      ]
      return matchedFields.some((item) => item.toLowerCase().includes(normalizedKeyword.value))
    })
    .sort((a, b) => {
      const groupCompare = (a.group_name || '').localeCompare(b.group_name || '', 'zh-CN')
      if (groupCompare !== 0) {
        return groupCompare
      }
      return (a.name || a.uuid).localeCompare(b.name || b.uuid, 'zh-CN')
    })
})

const onlineCount = computed(() => robots.value.filter((robot) => robot.status === 'online').length)
const pendingAccessCount = computed(() => robots.value.filter((robot) => !robot.ip && !robot.serverUrl).length)
const currentDetailRobot = computed(() => robots.value.find((robot) => robot.uuid === detailRobotId.value) || null)
const selectedDiscoveredRobot = computed(
  () => newlyDiscovered.value.find((robot) => robot.uuid === selectedDiscoveredRobotId.value) || null,
)
const newlyDiscovered = computed(() => discoveredRobots.value.filter((robot) => !existingRobotMap.value.has(robot.uuid)))
const alreadyDiscovered = computed(() => discoveredRobots.value.filter((robot) => existingRobotMap.value.has(robot.uuid)))
const cloudImportAvailable = computed(() => Boolean(accountStore.cloudBaseUrl.value && accountStore.isAuthenticated.value))

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

watch(
  () => [createDialogVisible.value, createTab.value, cloudImportAvailable.value] as const,
  ([visible, tab, cloudReady]) => {
    if (!visible || tab !== 'cloud' || !cloudReady || cloudLoading.value || cloudRobots.value.length > 0) {
      return
    }
    void loadCloudRobots()
  },
)

async function refreshRobots(): Promise<void> {
  loading.value = true
  try {
    const response = await getRobotList()
    robots.value = response.data.robots.map(补齐机器狗字段)

    if (detailVisible.value && currentDetailRobot.value) {
      await ensureAccessInfoLoaded()
      await loadDiagnosis(currentDetailRobot.value.uuid)
    }
  } finally {
    loading.value = false
  }
}

async function ensureAccessInfoLoaded(): Promise<void> {
  if (accessCandidates.value.length > 0) {
    return
  }
  const response = await getRobotAccessInfo()
  accessCandidates.value = response.data.candidates
}

function openCreateDialog(): void {
  resetCreateDialogState()
  createDialogVisible.value = true
}

function handleCreateDialogClosed(): void {
  resetCreateDialogState()
}

function resetCreateDialogState(): void {
  createTab.value = 'mdns'
  discoveryHasScanned.value = false
  discoveryMessage.value = ''
  discoveryMessageType.value = 'info'
  discoveredRobots.value = []
  selectedDiscoveredRobotId.value = ''
  discoveryGroupName.value = ''
  existingDiscoveredCollapsed.value = true
  manualForm.name = ''
  manualForm.ip = ''
  manualForm.group_name = ''
  selectedCloudRobotIds.value = []
  cloudGroupName.value = ''
  cloudMessage.value = ''
  cloudMessageType.value = 'info'
}

async function handleDiscoverRobots(): Promise<void> {
  discoveryLoading.value = true
  discoveryHasScanned.value = true
  discoveryMessage.value = ''
  selectedDiscoveredRobotId.value = ''
  existingDiscoveredCollapsed.value = true

  try {
    const response = await discoverLocalRobots(3)
    const list = response.data.robots.map((robot) => ({
      ...robot,
      name: robot.name || `机器狗-${robot.uuid.slice(0, 4)}`,
      model: robot.model || '',
      version: robot.version || '',
      ip: robot.ip || '',
      port: Number.isFinite(robot.port) ? robot.port : 8080,
    }))

    discoveredRobots.value = list
    const updatedCount = await 同步已存在机器人基础信息(list)

    if (updatedCount > 0) {
      await refreshRobots()
    }

    const messages: string[] = []
    if (updatedCount > 0) {
      messages.push(`已同步 ${updatedCount} 台本地已有机器人`)
    }
    if (list.filter((robot) => !existingRobotMap.value.has(robot.uuid)).length > 0) {
      messages.push(`发现 ${list.filter((robot) => !existingRobotMap.value.has(robot.uuid)).length} 台可新增机器人`)
    }
    if (messages.length === 0 && list.length > 0) {
      messages.push('所有扫描结果都已经在本地，且基础信息一致')
    }

    if (messages.length > 0) {
      discoveryMessage.value = messages.join('，')
      discoveryMessageType.value = 'success'
    }
  } catch (error) {
    discoveryMessage.value = 获取错误消息(error)
    discoveryMessageType.value = 'error'
  } finally {
    discoveryLoading.value = false
  }
}

async function 同步已存在机器人基础信息(list: DiscoveredRobot[]): Promise<number> {
  const updates = list.reduce<Array<ReturnType<typeof saveRobot>>>((result, robot) => {
      const existing = existingRobotMap.value.get(robot.uuid)
      if (!existing) {
        return result
      }

      const nextName = robot.name || existing.name
      const nextModel = robot.model || existing.model
      const nextIp = robot.ip || existing.ip
      const changed = existing.name !== nextName || existing.model !== nextModel || existing.ip !== nextIp
      if (!changed) {
        return result
      }

      result.push(saveRobot({
        uuid: existing.uuid,
        name: nextName,
        model: nextModel,
        ip: nextIp,
        group_name: existing.group_name,
        tags: existing.tags,
        sn: existing.sn,
        serverUrl: existing.serverUrl || 构建发现机器人服务地址(robot),
      }))
      return result
    }, [])

  if (updates.length === 0) {
    return 0
  }

  await Promise.all(updates)
  return updates.length
}

async function handleAddDiscoveredRobot(): Promise<void> {
  if (!selectedDiscoveredRobot.value) {
    ElMessage.warning('请先选择一台机器人')
    return
  }

  await saveRobot({
    uuid: selectedDiscoveredRobot.value.uuid,
    name: selectedDiscoveredRobot.value.name,
    model: selectedDiscoveredRobot.value.model || null,
    ip: selectedDiscoveredRobot.value.ip || null,
    group_name: 规范化可选字段(discoveryGroupName.value),
    serverUrl: 构建发现机器人服务地址(selectedDiscoveredRobot.value),
  })

  createDialogVisible.value = false
  await refreshRobots()
  ElMessage.success('已添加已发现的机器人')
}

async function handleManualAddRobot(): Promise<void> {
  const name = 规范化可选字段(manualForm.name)
  if (!name) {
    ElMessage.warning('请填写机器人名称')
    return
  }

  manualSaving.value = true
  try {
    const ip = 规范化可选字段(manualForm.ip)
    await saveRobot({
      uuid: uuidv7(),
      name,
      ip,
      group_name: 规范化可选字段(manualForm.group_name),
      serverUrl: ip ? `http://${ip}:8080` : null,
    })

    createDialogVisible.value = false
    await refreshRobots()
    ElMessage.success('机器狗已保存到本地')
  } finally {
    manualSaving.value = false
  }
}

async function loadCloudRobots(): Promise<void> {
  if (!cloudImportAvailable.value) {
    cloudMessage.value = '请先在个人中心配置云端地址并登录账号'
    cloudMessageType.value = 'warning'
    return
  }

  cloudLoading.value = true
  cloudMessage.value = ''
  try {
    const response = await fetchCloudRobotList()
    cloudRobots.value = [...response.data.robots].sort((a, b) => {
      const left = a.name || a.uuid
      const right = b.name || b.uuid
      return left.localeCompare(right, 'zh-CN')
    })
    cloudLastLoadedAt.value = new Date().toISOString()
  } catch (error) {
    cloudMessage.value = 获取错误消息(error)
    cloudMessageType.value = 'error'
  } finally {
    cloudLoading.value = false
  }
}

function handleCloudSelectionChange(selection: CloudRobotRecord[]): void {
  selectedCloudRobotIds.value = selection.map((item) => item.uuid)
}

async function handleImportSelectedCloudRobots(): Promise<void> {
  if (selectedCloudRobotIds.value.length === 0) {
    ElMessage.warning('请先选择至少一台云端机器人')
    return
  }

  const selectedRobots = cloudRobots.value.filter((robot) => selectedCloudRobotIds.value.includes(robot.uuid))
  await 导入云端机器人(selectedRobots)
}

async function handleImportSingleCloudRobot(robot: CloudRobotRecord): Promise<void> {
  await 导入云端机器人([robot])
}

async function 导入云端机器人(sourceRobots: CloudRobotRecord[]): Promise<void> {
  if (sourceRobots.length === 0) {
    return
  }

  cloudSyncing.value = true
  cloudMessage.value = ''
  try {
    await Promise.all(sourceRobots.map((robot) => {
      const existing = existingRobotMap.value.get(robot.uuid)
      return saveRobot(构建云端保存参数(robot, existing))
    }))

    const importedCount = sourceRobots.length
    cloudMessage.value = importedCount === 1 ? '已同步 1 台云端机器人到本地' : `已同步 ${importedCount} 台云端机器人到本地`
    cloudMessageType.value = 'success'
    createDialogVisible.value = false
    await refreshRobots()
    ElMessage.success(cloudMessage.value)
  } catch (error) {
    cloudMessage.value = 获取错误消息(error)
    cloudMessageType.value = 'error'
  } finally {
    cloudSyncing.value = false
  }
}

function 构建云端保存参数(robot: CloudRobotRecord, existing?: Robot): SaveRobotPayload {
  const ip = 获取云端机器人局域网IP(robot) || existing?.ip || null
  const serverUrl = 获取云端机器人服务地址(robot) || existing?.serverUrl || (ip ? `http://${ip}:8080` : null)

  return {
    uuid: robot.uuid,
    name: 规范化可选字段(robot.name) || existing?.name || robot.uuid,
    model: 规范化可选字段(robot.model) || existing?.model || null,
    ip,
    group_name: 规范化可选字段(cloudGroupName.value) || 规范化可选字段(robot.group_name) || existing?.group_name || null,
    tags: 解析云端标签(robot.tags, existing?.tags),
    sn: 规范化可选字段(robot.sn) || existing?.sn || null,
    serverUrl,
  }
}

function 获取云端机器人局域网IP(robot: CloudRobotRecord): string | null {
  const metadata = 解析云端元数据(robot.metadata)
  return 规范化可选字段(robot.local_ip)
    || 规范化可选字段(读取元数据文本(metadata, 'local_ip'))
    || 规范化可选字段(robot.ip)
    || 规范化可选字段(robot.robot_ip)
    || 规范化可选字段(读取元数据文本(metadata, 'robot_ip'))
}

function 获取云端机器人服务地址(robot: CloudRobotRecord): string | null {
  const ip = 获取云端机器人局域网IP(robot)
  if (!ip) {
    return null
  }

  const metadata = 解析云端元数据(robot.metadata)
  const rawPort = robot.local_port ?? Number.parseInt(读取元数据文本(metadata, 'local_port') || '', 10)
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 8080
  return `http://${ip}:${port}`
}

function 解析云端标签(tags: CloudRobotRecord['tags'], fallback: string[] = []): string[] {
  if (Array.isArray(tags)) {
    return tags
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      }
    } catch {
      return tags
        .split(/[,\n，]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    }
  }

  return fallback
}

function 解析云端元数据(metadata: CloudRobotRecord['metadata']): Record<string, unknown> {
  if (!metadata) {
    return {}
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }

  return typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function 读取元数据文本(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' ? value.trim() : null
}

function 构建发现机器人服务地址(robot: DiscoveredRobot): string | null {
  if (!robot.ip) {
    return null
  }
  const port = robot.port > 0 ? robot.port : 8080
  return `http://${robot.ip}:${port}`
}

function openEditDialog(robot: Robot): void {
  editingRobot.value = robot
  form.uuid = robot.uuid
  form.name = robot.name || ''
  form.model = robot.model || ''
  form.ip = robot.ip || ''
  form.group_name = robot.group_name || ''
  form.sn = robot.sn || ''
  form.serverUrl = robot.serverUrl || ''
  tagsText.value = (robot.tags || []).join(', ')
  dialogVisible.value = true
}

function resetForm(): void {
  editingRobot.value = null
  form.uuid = ''
  form.name = ''
  form.model = ''
  form.ip = ''
  form.group_name = ''
  form.sn = ''
  form.tags = []
  form.serverUrl = ''
  tagsText.value = ''
  formRef.value?.resetFields()
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !editingRobot.value) {
    return
  }

  saving.value = true
  try {
    const savedUuid = editingRobot.value.uuid
    await saveRobot({
      uuid: savedUuid,
      name: 规范化可选字段(form.name),
      model: 规范化可选字段(form.model),
      ip: 规范化可选字段(form.ip),
      group_name: 规范化可选字段(form.group_name),
      sn: 规范化可选字段(form.sn),
      tags: 解析标签(tagsText.value),
      serverUrl: 规范化可选字段(form.serverUrl),
    })

    dialogVisible.value = false
    resetForm()
    await refreshRobots()

    if (detailVisible.value && detailRobotId.value === savedUuid) {
      await refreshCurrentDiagnosis()
    }

    ElMessage.success('机器狗配置已保存')
  } catch (error) {
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function handleDelete(robot: Robot): Promise<void> {
  await ElMessageBox.confirm(`确定删除机器狗“${robot.name || robot.uuid}”吗？`, '删除确认', {
    type: 'warning',
  })

  await deleteRobot(robot.uuid)
  if (detailRobotId.value === robot.uuid) {
    detailVisible.value = false
    detailRobotId.value = ''
    diagnosis.value = null
  }
  ElMessage.success('机器狗已删除')
  await refreshRobots()
}

async function openDetail(robot: Robot): Promise<void> {
  detailRobotId.value = robot.uuid
  detailVisible.value = true
  diagnosis.value = null
  await Promise.all([
    ensureAccessInfoLoaded(),
    loadDiagnosis(robot.uuid),
  ])
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

async function refreshCurrentDiagnosis(): Promise<void> {
  if (!currentDetailRobot.value) {
    return
  }
  await loadDiagnosis(currentDetailRobot.value.uuid)
}

function buildBusinessUrl(candidate?: StudioAccessCandidate): string {
  if (!candidate || !currentDetailRobot.value) {
    return ''
  }
  return candidate.businessUrlTemplate.replace('{robotId}', encodeURIComponent(currentDetailRobot.value.uuid))
}

async function copyText(text: string): Promise<void> {
  if (!text) {
    return
  }
  await navigator.clipboard.writeText(text)
  ElMessage.success('已复制到剪贴板')
}

function 自动推导服务地址(robot: Robot): string | null {
  if (robot.serverUrl) {
    return robot.serverUrl
  }
  if (robot.ip) {
    return `http://${robot.ip}:8080`
  }
  return null
}

function 补齐机器狗字段(robot: Robot): Robot {
  return {
    ...robot,
    name: robot.name || null,
    model: robot.model || null,
    ip: robot.ip || null,
    group_name: robot.group_name || null,
    tags: Array.isArray(robot.tags) ? robot.tags : [],
    sn: robot.sn || null,
    serverUrl: robot.serverUrl || null,
  }
}

function 规范化可选字段(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function 解析标签(value: string): string[] {
  return value
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function 获取错误消息(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败'
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

onMounted(async () => {
  void accountStore.initialize()
  await refreshRobots()
})
</script>

<style scoped>
.robot-management {
  min-height: 100%;
  padding: 20px;
  color: var(--studio-text-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.overview-grid,
.robot-grid,
.diagnosis-grid,
.candidate-list,
.guide-grid,
.detail-info-grid,
.discovery-list {
  display: grid;
  gap: 16px;
}

.overview-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.overview-item {
  min-width: 0;
}

.overview-item :deep(.el-tooltip__trigger) {
  display: block;
  width: 100%;
}

.overview-panel,
.overview-card,
.robot-card,
.detail-hero,
.detail-info-item,
.diagnosis-card,
.candidate-card,
.guide-card,
.discovery-card,
.create-dialog-stack :deep(.el-table),
.create-dialog-stack :deep(.el-alert) {
  border-radius: 8px;
}

.overview-panel,
.overview-card,
.robot-card,
.detail-hero,
.detail-info-item,
.diagnosis-card,
.candidate-card,
.guide-card,
.discovery-card {
  border: 1px solid var(--studio-border);
  background: var(--studio-card-background);
  box-shadow: var(--studio-shadow);
}

.overview-panel {
  margin-top: 18px;
  padding: 20px;
  background: var(--studio-panel-background-strong);
}

.overview-card.accent {
  background: var(--studio-card-background-strong);
}

.overview-card span,
.summary-row span,
.detail-info-item span,
.guide-card span {
  display: block;
  color: var(--studio-text-muted);
  font-size: 13px;
}

.overview-card strong {
  display: block;
  margin-top: 12px;
  font-size: 34px;
  line-height: 1;
}

.overview-card {
  padding: 20px;
  cursor: default;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}

.overview-card:hover,
.robot-card:hover,
.discovery-card:hover {
  transform: translateY(-2px);
  border-color: var(--studio-border-strong);
}

.section-header p,
.diagnosis-top p,
.guide-card p,
.create-toolbar p,
.create-section-description {
  margin: 10px 0 0;
  line-height: 1.7;
  color: var(--studio-text-secondary);
}

.toolbar-row,
.toolbar-summary,
.robot-card-top,
.robot-title-row,
.robot-card-actions,
.detail-hero,
.detail-hero-actions,
.section-header,
.section-header-with-action,
.diagnosis-top,
.diagnosis-meta,
.candidate-top,
.create-toolbar,
.discovery-row,
.inline-form-row,
.create-footer {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.toolbar-row {
  margin-top: 18px;
  align-items: center;
}

.keyword-input {
  flex: 1;
}

.group-select {
  width: 220px;
}

.toolbar-summary {
  margin-top: 12px;
  flex-wrap: wrap;
  color: var(--studio-text-muted);
  font-size: 13px;
}

.robot-grid {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  margin-top: 18px;
}

.robot-card {
  padding: 14px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.robot-title-block {
  min-width: 0;
}

.robot-title-row strong {
  font-size: 16px;
  line-height: 1.4;
}

.robot-uuid {
  margin: 6px 0 0;
  color: var(--studio-text-muted);
  font-size: 12px;
  word-break: break-all;
}

.robot-summary-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--studio-border);
}

.summary-row:last-child {
  border-bottom: 0;
}

.summary-row strong,
.detail-info-item strong {
  display: block;
  margin-top: 0;
  word-break: break-all;
  line-height: 1.6;
  text-align: right;
}

.candidate-card code,
.guide-card code,
.diagnosis-card code {
  display: block;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--studio-code-background);
  color: var(--studio-code-text);
  line-height: 1.6;
  word-break: break-all;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.robot-card-actions {
  margin-top: 12px;
}

.empty-panel {
  margin-top: 18px;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  background: var(--studio-panel-background-strong);
}

.empty-description {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-description p {
  margin: 0;
  color: var(--studio-text-secondary);
}

.detail-stack,
.create-dialog-stack,
.create-tab-stack,
.simple-form,
.existing-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-hero,
.detail-info-item,
.diagnosis-card,
.candidate-card,
.guide-card,
.discovery-card {
  padding: 18px;
}

.detail-hero h3,
.section-header h3,
.create-toolbar strong {
  margin: 0;
}

.detail-hero p {
  margin: 8px 0 0;
  color: var(--studio-text-muted);
  word-break: break-all;
}

.detail-hero-actions {
  align-items: center;
}

.detail-info-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-caption {
  color: var(--studio-text-muted);
  font-size: 12px;
}

.loading-panel,
.empty-inline {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--studio-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.26);
}

.diagnosis-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.diagnosis-card.is-success {
  border-color: rgba(16, 185, 129, 0.34);
}

.diagnosis-card.is-warning {
  border-color: rgba(245, 158, 11, 0.34);
}

.diagnosis-card.is-danger {
  border-color: rgba(239, 68, 68, 0.34);
}

.diagnosis-card.is-info {
  border-color: rgba(148, 163, 184, 0.3);
}

.diagnosis-top strong,
.candidate-top strong,
.discovery-main strong {
  display: block;
}

.diagnosis-meta {
  margin-top: 12px;
  color: var(--studio-text-muted);
  font-size: 12px;
}

.candidate-list {
  grid-template-columns: 1fr;
}

.candidate-top p {
  margin: 6px 0 0;
  color: var(--studio-text-muted);
}

.guide-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.create-section-description {
  margin: 0;
}

.discovery-list {
  grid-template-columns: 1fr;
}

.discovery-card {
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}

.discovery-card.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.25);
}

.discovery-card.existing {
  opacity: 0.78;
}

.discovery-main {
  min-width: 0;
}

.inline-form-row {
  align-items: center;
}

.inline-form-row :deep(.el-input) {
  flex: 1;
}

.create-footer {
  justify-content: flex-end;
}

.table-main-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-main-cell span {
  color: var(--studio-text-muted);
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 1380px) {
  .guide-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .robot-management {
    padding: 16px;
  }

  .robot-grid,
  .diagnosis-grid,
  .guide-grid,
  .detail-info-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-row,
  .header-actions,
  .robot-card-actions,
  .detail-hero,
  .detail-hero-actions,
  .section-header-with-action,
  .diagnosis-meta,
  .candidate-top,
  .create-toolbar,
  .discovery-row,
  .inline-form-row {
    flex-direction: column;
  }

  .group-select {
    width: 100%;
  }

  .summary-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .summary-row strong {
    text-align: left;
  }
}
</style>
