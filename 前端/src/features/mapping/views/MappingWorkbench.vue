<template>
  <div class="mapping-workbench">
    <PageHeader
      title="地图工作台"
      :icon="Map"
      @back="goHome"
    >
      <template #extra>
        <div class="header-actions">
          <el-button-group class="panel-toggles">
            <el-button
              :type="showMapsPanel ? 'primary' : ''"
              size="small"
              title="左侧地图仓库"
              @click="showMapsPanel = !showMapsPanel"
            >
              <el-icon><Fold /></el-icon>
            </el-button>
            <el-button
              :type="showRuntimePanel ? 'primary' : ''"
              size="small"
              title="右侧运行与命令"
              @click="showRuntimePanel = !showRuntimePanel"
            >
              <el-icon><Expand /></el-icon>
            </el-button>
          </el-button-group>
          <el-select
            v-model="selectedRobotId"
            class="robot-select"
            clearable
            filterable
            placeholder="选择机器人读取真机遥测"
          >
            <el-option
              v-for="robot in robots"
              :key="robot.uuid"
              :label="robot.name || robot.uuid"
              :value="robot.uuid"
            >
              <div class="robot-option">
                <span>{{ robot.name || robot.uuid }}</span>
                <small>{{ robot.serverUrl || robot.ip || '-' }}</small>
              </div>
            </el-option>
          </el-select>
          <el-button
            type="primary"
            :loading="loading"
            :icon="RefreshRight"
            @click="refreshAll"
          >
            刷新状态
          </el-button>
        </div>
      </template>
    </PageHeader>

    <div
      class="workbench-grid"
      :class="{
        'is-maps-collapsed': !showMapsPanel,
        'is-runtime-collapsed': !showRuntimePanel,
      }"
    >
      <aside
        v-show="showMapsPanel"
        class="panel maps-panel"
      >
        <div class="panel-surface">
          <div class="panel-header">
            <div>
              <h2>地图仓库</h2>
              <p>自动扫描本地 `yaml + pgm/png` 地图</p>
            </div>
            <div class="panel-actions">
              <el-tag type="info">
                {{ maps.length }} 张
              </el-tag>
              <el-button
                plain
                :loading="openingDirectory"
                @click="openMapDirectory"
              >
                打开目录
              </el-button>
            </div>
          </div>

          <el-alert
            v-if="showRobotMapHint"
            class="map-source-alert"
            type="info"
            :closable="false"
            show-icon
          >
            <template #title>
              真机构图结果保存在机器人：{{ remoteSavedMapYamlPath || remoteMapSaveDir }}
            </template>
            <template #default>
              左侧地图仓库当前只扫描工作站本地目录 `{{ runtime.mapDirectory }}`，不会自动同步真机 `{{ remoteLatestMapName || '最新' }}` 地图。
            </template>
          </el-alert>

          <div
            v-if="maps.length === 0"
            class="empty-state"
          >
            <el-empty description="暂无可用地图">
              <template #description>
                <div class="empty-description">
                  <p>请把地图文件放到本地目录后刷新：</p>
                  <code>{{ runtime.mapDirectory || '加载中...' }}</code>
                  <p v-if="remoteLatestMapName">
                    最近真机地图：{{ remoteLatestMapName }}
                  </p>
                  <code v-if="remoteSavedMapYamlPath">{{ remoteSavedMapYamlPath }}</code>
                </div>
              </template>
            </el-empty>
          </div>

          <div
            v-else
            class="map-list"
          >
            <button
              v-for="item in maps"
              :key="item.id"
              type="button"
              class="map-card"
              :class="{ active: item.id === selectedMapId }"
              @click="selectedMapId = item.id"
            >
              <div class="map-card-top">
                <div>
                  <strong>{{ item.name }}</strong>
                  <p>{{ item.imageFormat.toUpperCase() }} / {{ item.resolution.toFixed(3) }}m</p>
                </div>
                <el-tag
                  size="small"
                  :type="runtime.activeMapId === item.id ? 'success' : 'info'"
                >
                  {{ runtime.activeMapId === item.id ? '当前' : '待选' }}
                </el-tag>
              </div>
              <div class="map-card-meta">
                <span>原点 {{ formatOrigin(item.origin) }}</span>
                <span>更新时间 {{ formatTime(item.updatedAt) }}</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <main class="panel viewer-panel">
        <div class="panel-surface">
          <div class="panel-header">
            <div>
              <h2>地图画布</h2>
              <p>显示地图底图，并叠加机器人位姿、目标位姿与实时激光扫描</p>
            </div>
            <div class="canvas-legend">
              <span><i class="legend-dot robot" />机器人</span>
              <span><i class="legend-dot goal" />目标点</span>
              <span><i class="legend-dot lidar" />激光扫描</span>
              <span><i class="legend-dot nav-path" />导航路径</span>
              <span><i class="legend-dot patrol-path" />巡逻路线</span>
            </div>
          </div>

          <div
            v-if="!selectedMap"
            class="viewer-empty"
          >
            <div
              v-if="standaloneLidarPreviewReady"
              class="realtime-preview"
            >
              <div class="realtime-preview-header">
                <strong>实时激光预览</strong>
                <span>{{ standaloneLidarPreviewSummary }}</span>
              </div>

              <svg
                class="realtime-preview-canvas"
                :viewBox="`0 0 ${STANDALONE_LIDAR_PREVIEW_SIZE} ${STANDALONE_LIDAR_PREVIEW_SIZE}`"
                aria-label="实时激光预览"
              >
                <circle
                  class="preview-ring"
                  :cx="STANDALONE_LIDAR_PREVIEW_HALF"
                  :cy="STANDALONE_LIDAR_PREVIEW_HALF"
                  :r="STANDALONE_LIDAR_PREVIEW_HALF * 0.25"
                />
                <circle
                  class="preview-ring"
                  :cx="STANDALONE_LIDAR_PREVIEW_HALF"
                  :cy="STANDALONE_LIDAR_PREVIEW_HALF"
                  :r="STANDALONE_LIDAR_PREVIEW_HALF * 0.5"
                />
                <circle
                  class="preview-ring"
                  :cx="STANDALONE_LIDAR_PREVIEW_HALF"
                  :cy="STANDALONE_LIDAR_PREVIEW_HALF"
                  :r="STANDALONE_LIDAR_PREVIEW_HALF * 0.75"
                />
                <line
                  class="preview-axis"
                  :x1="STANDALONE_LIDAR_PREVIEW_HALF"
                  y1="24"
                  :x2="STANDALONE_LIDAR_PREVIEW_HALF"
                  :y2="STANDALONE_LIDAR_PREVIEW_SIZE - 24"
                />
                <line
                  class="preview-axis"
                  x1="24"
                  :y1="STANDALONE_LIDAR_PREVIEW_HALF"
                  :x2="STANDALONE_LIDAR_PREVIEW_SIZE - 24"
                  :y2="STANDALONE_LIDAR_PREVIEW_HALF"
                />
                <circle
                  class="preview-robot"
                  :cx="STANDALONE_LIDAR_PREVIEW_HALF"
                  :cy="STANDALONE_LIDAR_PREVIEW_HALF"
                  r="7"
                />
                <circle
                  v-for="point in standaloneLidarPreviewPoints"
                  :key="point.id"
                  class="preview-point"
                  :cx="point.x"
                  :cy="point.y"
                  r="1.8"
                />
              </svg>

              <p class="realtime-preview-tip">
                当前未选择本地底图，已回退到雷达实时预览。真机地图保存后仍需同步到工作站本地目录，才能作为底图显示。
              </p>
            </div>

            <el-empty
              v-else
              description="请选择左侧地图"
            >
              <template
                v-if="showRobotMapHint"
                #description
              >
                <div class="empty-description">
                  <p>真机最近地图：{{ remoteLatestMapName || '未上报' }}</p>
                  <code>{{ remoteSavedMapYamlPath || remoteMapSaveDir }}</code>
                  <p>左侧仍只展示工作站本地地图仓库。</p>
                </div>
              </template>
            </el-empty>
          </div>

          <div
            v-else
            class="viewer-stage"
          >
            <div class="map-stage-meta">
              <span>地图文件：{{ selectedMap.yamlPath }}</span>
              <span>图片文件：{{ selectedMap.imagePath }}</span>
            </div>
            <div
              class="canvas-tip"
              :class="{ 'canvas-tip-pending': pendingGoalAnchor }"
            >
              {{ pendingGoalAnchor ? '已设置目标点，请在画布上再点击一次确定朝向。' : '在画布上点击可设置导航目标；连续两次点击可精确设置朝向。' }}
            </div>

            <div class="map-canvas-scroll">
              <div
                v-if="mapImageBroken"
                class="viewer-empty"
              >
                <el-result
                  icon="warning"
                  title="地图图片加载失败"
                  sub-title="请检查地图图片路径是否存在，或确认工作站后端是否正在运行。"
                />
              </div>

              <div
                v-else
                class="map-canvas"
                @click="handleMapCanvasClick"
              >
                <img
                  ref="mapImageRef"
                  class="map-image"
                  :src="selectedMap.imageUrl"
                  :alt="selectedMap.name"
                  @load="handleImageLoad"
                  @error="handleImageError"
                >

                <svg
                  v-if="lidarScanPoints.length > 0"
                  class="scan-overlay"
                  :viewBox="`0 0 ${mapImageSize.width} ${mapImageSize.height}`"
                  preserveAspectRatio="none"
                >
                  <circle
                    v-for="point in lidarScanPoints"
                    :key="point.id"
                    class="scan-point"
                    :cx="point.x"
                    :cy="point.y"
                    r="1.6"
                  />
                </svg>

                <svg
                  v-if="navigationPathPolyline || patrolRoutePolyline"
                  class="route-overlay"
                  :viewBox="`0 0 ${mapImageSize.width} ${mapImageSize.height}`"
                  preserveAspectRatio="none"
                >
                  <polyline
                    v-if="patrolRoutePolyline"
                    class="patrol-route-line"
                    :points="patrolRoutePolyline"
                  />
                  <polyline
                    v-if="navigationPathPolyline"
                    class="navigation-route-line"
                    :points="navigationPathPolyline"
                  />
                  <circle
                    v-for="item in patrolRouteMarkers"
                    :key="`patrol-${item.index}`"
                    class="patrol-route-point"
                    :class="{ active: item.active }"
                    :cx="item.x"
                    :cy="item.y"
                    :r="item.active ? 7 : 5"
                  />
                </svg>

                <div
                  v-if="draftGoalPoseStyle"
                  class="pose-marker draft-goal"
                  :style="draftGoalPoseStyle"
                  :title="pendingGoalAnchor ? '待确认导航朝向' : '导航表单目标'"
                >
                  <span class="pose-arrow pose-arrow-draft" />
                </div>

                <div
                  v-if="currentPoseStyle"
                  class="pose-marker robot"
                  :style="currentPoseStyle"
                  title="机器人当前位置"
                >
                  <span class="pose-arrow" />
                </div>

                <div
                  v-if="goalPoseStyle"
                  class="pose-marker goal"
                  :style="goalPoseStyle"
                  title="目标位姿"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside
        v-show="showRuntimePanel"
        class="panel runtime-panel"
      >
        <div class="panel-surface">
          <div class="runtime-panel-scroll">
            <div class="panel-header">
              <div>
                <h2>运行与命令</h2>
                <p>本地优先的建图、定位、导航与巡逻调试面板</p>
              </div>
            </div>

            <div class="overview-grid">
              <div
                v-for="item in runtimeOverviewItems"
                :key="item.label"
                class="overview-chip"
              >
                <span>{{ item.label }}</span>
                <el-tag
                  size="small"
                  :type="item.type"
                >
                  {{ item.value }}
                </el-tag>
              </div>
            </div>

            <div class="runtime-section">
              <h3>地图与定位命令</h3>
              <div class="form-grid">
                <el-input
                  v-model="mapNameInput"
                  placeholder="地图名称，可留空"
                />
              </div>
              <div class="command-grid">
                <el-button
                  type="warning"
                  plain
                  :disabled="!canSendCommand"
                  @click="sendMapCommand('start_mapping')"
                >
                  开始建图
                </el-button>
                <el-button
                  plain
                  :disabled="!canSendCommand || !runtime.mappingActive"
                  @click="sendMapCommand('stop_mapping')"
                >
                  停止并保存
                </el-button>
                <el-button
                  type="primary"
                  plain
                  :disabled="!selectedMap || !canSendCommand"
                  @click="sendMapCommand('load_map', selectedMap?.id)"
                >
                  加载选中地图
                </el-button>
                <el-button
                  type="success"
                  plain
                  :disabled="!selectedMap || !canSendCommand"
                  @click="sendMapCommand('start_localization', selectedMap?.id)"
                >
                  启动定位
                </el-button>
                <el-button
                  plain
                  :disabled="!runtime.localizationActive || !canSendCommand"
                  @click="sendMapCommand('stop_localization')"
                >
                  停止定位
                </el-button>
              </div>
            </div>

            <div class="runtime-section">
              <h3>单点导航</h3>
              <div class="detail-list">
                <div
                  v-for="item in navigationDetailItems"
                  :key="item.label"
                  class="detail-item"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div
                v-if="navigationFailureReason"
                class="runtime-error navigation-error-panel"
              >
                <strong>导航失败</strong>
                <p>{{ navigationFailureReason }}</p>
                <p v-if="retryNavigationSummary">
                  最近目标：{{ retryNavigationSummary }}
                </p>
                <div
                  v-if="canRetryFailedNavigation"
                  class="section-actions section-actions--compact"
                >
                  <el-button
                    type="danger"
                    plain
                    @click="retryFailedNavigation"
                  >
                    重试本次导航
                  </el-button>
                </div>
              </div>
              <div class="form-grid form-grid--goal">
                <el-input-number
                  v-model="navGoalX"
                  :step="0.1"
                  controls-position="right"
                  placeholder="X"
                />
                <el-input-number
                  v-model="navGoalY"
                  :step="0.1"
                  controls-position="right"
                  placeholder="Y"
                />
                <el-input-number
                  v-model="navGoalYaw"
                  :step="0.1"
                  controls-position="right"
                  placeholder="Yaw"
                />
                <el-input
                  v-model="navGoalFrameId"
                  placeholder="frame_id"
                />
                <el-input
                  v-model="navGoalMapName"
                  class="form-grid__span-2"
                  placeholder="目标地图，可留空"
                />
              </div>
              <div class="section-actions">
                <el-button
                  type="primary"
                  :disabled="!canSendCommand"
                  @click="sendNavigationCommand('navigate_to')"
                >
                  导航到点
                </el-button>
                <el-button
                  :disabled="!canSendCommand"
                  @click="sendNavigationCommand('cancel')"
                >
                  取消导航
                </el-button>
              </div>
            </div>

            <div class="runtime-section">
              <h3>任务与巡逻</h3>
              <div class="detail-list">
                <div
                  v-for="item in taskDetailItems"
                  :key="item.label"
                  class="detail-item"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div class="form-grid">
                <el-input
                  v-model="patrolTaskName"
                  placeholder="巡逻任务名，可留空"
                />
                <el-select
                  v-model="patrolWaypointFile"
                  filterable
                  clearable
                  placeholder="选择巡逻点位文件"
                >
                  <el-option
                    v-for="item in waypointFiles"
                    :key="item.id"
                    :label="item.name"
                    :value="item.path"
                  >
                    <div class="robot-option">
                      <span>{{ item.name }}</span>
                      <small>{{ item.path }}</small>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div class="section-actions">
                <el-button
                  plain
                  :loading="loadingWaypoints"
                  @click="refreshWaypoints"
                >
                  刷新巡逻文件
                </el-button>
                <el-button
                  plain
                  :loading="openingWaypointDirectory"
                  @click="openWaypointDirectory"
                >
                  打开巡逻目录
                </el-button>
              </div>
              <div
                v-if="patrolWaypointFile"
                class="patrol-preview"
              >
                <div class="patrol-preview-header">
                  <div>
                    <strong>{{ waypointFileDetail?.name || '巡逻文件预览' }}</strong>
                    <p>{{ selectedWaypointFile?.path || patrolWaypointFile }}</p>
                  </div>
                  <el-tag
                    size="small"
                    type="info"
                  >
                    {{ waypointFileDetail?.waypointCount ?? 0 }} 点
                  </el-tag>
                </div>

                <div
                  v-if="loadingWaypointDetail"
                  class="history-empty"
                >
                  正在读取巡逻文件详情...
                </div>
                <div
                  v-else-if="waypointFileDetail"
                  class="patrol-preview-body"
                >
                  <div
                    v-if="patrolMapValidationMessage"
                    class="runtime-tip"
                    :class="{ 'runtime-tip-success': patrolMapValidationType === 'success' }"
                  >
                    {{ patrolMapValidationMessage }}
                  </div>
                  <div class="detail-list">
                    <div class="detail-item">
                      <span>路线名</span>
                      <strong>{{ waypointFileDetail.name }}</strong>
                    </div>
                    <div class="detail-item">
                      <span>地图名</span>
                      <strong>{{ waypointFileDetail.mapName || '未填写' }}</strong>
                    </div>
                    <div class="detail-item">
                      <span>是否循环</span>
                      <strong>{{ waypointFileDetail.loop ? '是' : '否' }}</strong>
                    </div>
                    <div class="detail-item">
                      <span>默认等待</span>
                      <strong>{{ formatWaitSeconds(waypointFileDetail.arrivalWaitSec) }}</strong>
                    </div>
                    <div class="detail-item">
                      <span>更新时间</span>
                      <strong>{{ formatTime(waypointFileDetail.updatedAt) }}</strong>
                    </div>
                  </div>

                  <div class="patrol-waypoint-list">
                    <div
                      v-for="item in waypointFileDetail.waypoints"
                      :key="`${item.index}-${item.name}`"
                      class="patrol-waypoint-card"
                      :class="{ active: isSelectedWaypointRunning && activePatrolWaypointIndex === item.index }"
                    >
                      <div class="patrol-waypoint-top">
                        <strong>{{ item.name }}</strong>
                        <el-tag size="small">
                          #{{ item.index + 1 }}
                        </el-tag>
                      </div>
                      <p>{{ formatWaypointPose(item) }}</p>
                      <p>坐标系 {{ item.frameId || '未填写' }} / 等待 {{ formatWaitSeconds(item.arrivalWaitSec) }}</p>
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="runtime-error"
                >
                  当前巡逻文件详情读取失败，请刷新后重试。
                </div>
              </div>
              <div
                v-if="patrolProgressItems.length > 0"
                class="detail-list patrol-progress-list"
              >
                <div
                  v-for="item in patrolProgressItems"
                  :key="item.label"
                  class="detail-item"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div class="section-actions">
                <el-button
                  type="primary"
                  :disabled="!canSendCommand"
                  @click="sendPatrolCommand('start_patrol')"
                >
                  开始巡逻
                </el-button>
                <el-button
                  :disabled="!canSendCommand"
                  @click="sendTaskControl('pause')"
                >
                  暂停任务
                </el-button>
                <el-button
                  :disabled="!canSendCommand"
                  @click="sendTaskControl('resume')"
                >
                  恢复任务
                </el-button>
                <el-button
                  :disabled="!canSendCommand"
                  @click="sendTaskControl('terminate')"
                >
                  终止任务
                </el-button>
              </div>
            </div>

            <div
              v-if="runtime.commandSource === 'pending_robot'"
              class="runtime-tip"
            >
              已读取真机遥测，但当前机器人未连接到工作站业务通道，命令按钮已禁用。
            </div>

            <div
              v-if="runtime.commandSource === 'robot_ws'"
              class="runtime-tip runtime-tip-success"
            >
              当前机器人已连接到工作站业务通道，命令会直接通过 `robot-agent` 下发。
            </div>

            <div class="runtime-section">
              <h3>机器人遥测</h3>
              <div
                v-if="!runtime.selectedRobot"
                class="history-empty"
              >
                当前未选择机器人，页面使用工作站本地桩状态。
              </div>
              <div
                v-else
                class="robot-runtime-card"
              >
                <div class="robot-runtime-top">
                  <strong>{{ runtime.selectedRobot.name }}</strong>
                  <el-tag :type="robotStatusSummaryType">
                    {{ robotStatusSummaryText }}
                  </el-tag>
                </div>
                <div class="robot-connection-grid">
                  <div
                    v-for="item in robotConnectionItems"
                    :key="item.label"
                    class="robot-connection-item"
                  >
                    <span>{{ item.label }}</span>
                    <el-tag
                      size="small"
                      :type="item.type"
                    >
                      {{ item.value }}
                    </el-tag>
                  </div>
                </div>
                <div class="robot-runtime-meta">
                  <span>IP: {{ runtime.selectedRobot.ip }}</span>
                  <span>服务: {{ runtime.selectedRobot.serverUrl || '-' }}</span>
                  <span>状态: {{ runtime.selectedRobot.status }}</span>
                  <span>工作站通道: {{ runtime.selectedRobot.wsConnected ? '已连接' : '未连接' }}</span>
                  <span>拉取时间: {{ runtime.selectedRobot.telemetryFetchedAt ? formatTime(runtime.selectedRobot.telemetryFetchedAt) : '-' }}</span>
                </div>
                <div
                  v-if="runtime.selectedRobot.telemetryError"
                  class="runtime-error"
                >
                  {{ runtime.selectedRobot.telemetryError }}
                </div>
                <div
                  v-if="runtime.selectedRobot.telemetryAvailableTypes.length > 0"
                  class="telemetry-tags"
                >
                  <el-tag
                    v-for="type in runtime.selectedRobot.telemetryAvailableTypes"
                    :key="type"
                    size="small"
                    effect="plain"
                  >
                    {{ type }}
                  </el-tag>
                </div>
              </div>
            </div>

            <div class="runtime-section">
              <h3>地图与定位状态</h3>
              <div class="detail-list">
                <div
                  v-for="item in mapDetailItems"
                  :key="item.label"
                  class="detail-item"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>

            <div class="runtime-section">
              <h3>运控桥与雷达</h3>
              <div class="detail-list">
                <div
                  v-for="item in bridgeDetailItems"
                  :key="item.label"
                  class="detail-item"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
                <div
                  v-for="item in sensorDetailItems"
                  :key="item.label"
                  class="detail-item"
                >
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>

            <div class="runtime-section">
              <h3>位姿数据</h3>
              <div class="pose-card">
                <p class="pose-title">
                  机器人位姿
                </p>
                <p>{{ formatPose(currentPose) }}</p>
              </div>
              <div class="pose-card">
                <p class="pose-title">
                  目标位姿
                </p>
                <p>{{ formatPose(runtime.goalPose) }}</p>
              </div>
            </div>

            <div class="runtime-section">
              <h3>命令历史</h3>
              <div
                v-if="runtime.commandHistory.length === 0"
                class="history-empty"
              >
                暂无命令记录
              </div>
              <div
                v-else
                class="history-list"
              >
                <div
                  v-for="record in runtime.commandHistory"
                  :key="`${record.timestamp}-${record.channel}-${record.command}`"
                  class="history-item"
                >
                  <strong>{{ commandLabelMap[record.command] }}</strong>
                  <span>{{ commandChannelLabelMap[record.channel] }} / {{ record.mapId || '无附加地图' }}</span>
                  <time>{{ formatTime(record.timestamp) }}</time>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Expand, Fold, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Map } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/share/components/PageHeader.vue'
import { getRobotList } from '@/features/robot/api'
import type { Robot } from '@/features/robot/types'
import { useWebSocket } from '@/share/websocket/useWebSocket'
import { mappingApi } from '../api'
import type {
  LidarScan,
  MappingCommand,
  MappingRuntime,
  NavigationCommand,
  NavigationGoal,
  PatrolCommand,
  PlanarPose,
  RuntimeCommand,
  RuntimeDogBridgeData,
  RuntimeLidarData,
  StudioMap,
  WaypointFile,
  WaypointFileDetail,
} from '../types'

const router = useRouter()
const loading = ref(false)
const openingDirectory = ref(false)
const openingWaypointDirectory = ref(false)
const loadingWaypoints = ref(false)
const loadingWaypointDetail = ref(false)
const maps = ref<StudioMap[]>([])
const waypointFiles = ref<WaypointFile[]>([])
const waypointFileDetail = ref<WaypointFileDetail | null>(null)
const robots = ref<Robot[]>([])
const selectedRobotId = ref('')
const showMapsPanel = ref(true)
const showRuntimePanel = ref(true)
const selectedMapId = ref<string>('')
const mapNameInput = ref('')
const navGoalX = ref(0)
const navGoalY = ref(0)
const navGoalYaw = ref(0)
const navGoalFrameId = ref('map')
const navGoalMapName = ref('')
const patrolTaskName = ref('')
const patrolWaypointFile = ref('')
const mapImageSize = ref({ width: 0, height: 0 })
const mapImageBroken = ref(false)
const mapImageRef = ref<HTMLImageElement | null>(null)
const showDraftGoal = ref(false)
const pendingGoalAnchor = ref<{ x: number; y: number } | null>(null)
const runtime = ref<MappingRuntime>({
  mode: 'idle',
  activeMapId: null,
  mappingActive: false,
  localizationActive: false,
  currentPose: null,
  goalPose: null,
  lidarScan: null,
  lastCommand: null,
  lastCommandAt: null,
  commandHistory: [],
  availableMapCount: 0,
  mapDirectory: '',
  telemetrySource: 'stub',
  commandSource: 'stub',
  selectedRobot: null,
  robotSummary: null,
  navigationState: null,
  mapState: null,
  taskState: null,
  sensorState: null,
})

const commandLabelMap: Record<RuntimeCommand, string> = {
  start_mapping: '开始建图',
  stop_mapping: '停止并保存',
  load_map: '加载地图',
  start_localization: '启动定位',
  stop_localization: '停止定位',
  navigate_to: '导航到点',
  cancel: '取消导航',
  pause: '暂停任务',
  resume: '恢复任务',
  terminate: '终止任务',
  start_patrol: '开始巡逻',
}

const commandChannelLabelMap = {
  map: '地图命令',
  navigation: '导航命令',
  patrol: '巡逻命令',
} as const
const STANDALONE_LIDAR_PREVIEW_SIZE = 520
const STANDALONE_LIDAR_PREVIEW_HALF = STANDALONE_LIDAR_PREVIEW_SIZE / 2

const canSendCommand = computed(() => runtime.value.commandSource === 'stub' || runtime.value.commandSource === 'robot_ws')
const selectedMap = computed(() => maps.value.find((item) => item.id === selectedMapId.value) || null)
const selectedWaypointFile = computed(() => waypointFiles.value.find((item) => item.path === patrolWaypointFile.value.trim()) || null)
const activeMap = computed(() => maps.value.find((item) => item.id === runtime.value.activeMapId) || null)
const currentPose = computed(() => runtime.value.lidarScan?.pose ?? runtime.value.currentPose)
const currentPoseStyle = computed(() => buildPoseStyle(currentPose.value, true))
const remoteMapSaveDir = computed(() => extractStringField(mapRuntimeState.value ?? {}, ['save_dir']))
const remoteLatestMapName = computed(() => extractStringField(mapRuntimeState.value ?? {}, ['last_map']))
const remoteSavedMapYamlPath = computed(() => {
  if (!remoteMapSaveDir.value || !remoteLatestMapName.value) {
    return ''
  }
  return joinDisplayPath(remoteMapSaveDir.value, `${remoteLatestMapName.value}.yaml`)
})
const showRobotMapHint = computed(() => {
  if (!runtime.value.selectedRobot || !runtime.value.selectedRobot.wsConnected) {
    return false
  }
  if (!remoteMapSaveDir.value) {
    return false
  }
  return normalizeDisplayPath(remoteMapSaveDir.value) !== normalizeDisplayPath(runtime.value.mapDirectory)
})
const draftGoalPoseStyle = computed(() => {
  if (!showDraftGoal.value || !selectedMap.value || mapImageSize.value.width <= 0 || mapImageSize.value.height <= 0) {
    return null
  }

  const targetMapName = navGoalMapName.value.trim()
  if (targetMapName && targetMapName !== selectedMap.value.name) {
    return null
  }

  return buildPoseStyle(
    {
      position: [navGoalX.value, navGoalY.value, 0],
      orientation: [0, 0, 0, 1],
      yaw: navGoalYaw.value,
      confidence: 1,
    },
    true,
  )
})
const goalPoseStyle = computed(() => buildPoseStyle(runtime.value.goalPose, false))
const lidarScanPoints = computed(() => buildLidarScanPoints(runtime.value.lidarScan, currentPose.value))
const standaloneLidarPreviewPoints = computed(() => buildStandaloneLidarPreviewPoints(runtime.value.lidarScan))
const standaloneLidarPreviewReady = computed(() => !selectedMap.value && standaloneLidarPreviewPoints.value.length > 0)
const standaloneLidarPreviewSummary = computed(() => {
  const scan = runtime.value.lidarScan
  if (!scan) {
    return '等待激光数据'
  }
  return `${scan.pointCount} 点 / ${scan.rangeMax.toFixed(1)}m 量程`
})
const mapRuntimeState = computed(() => runtime.value.mapState ?? runtime.value.robotSummary?.mapping ?? null)
const localizationRuntimeState = computed(() => runtime.value.robotSummary?.localization ?? null)
const navigationRuntimeState = computed(() => runtime.value.navigationState ?? runtime.value.robotSummary?.navigation ?? null)
const taskRuntimeState = computed(() => runtime.value.taskState ?? runtime.value.robotSummary?.task ?? null)
const dogBridgeRuntimeState = computed(() => runtime.value.robotSummary?.dog_bridge ?? null)
const lidarRuntimeState = computed<RuntimeLidarData | null>(() => {
  const sensorLidar = runtime.value.sensorState?.lidar
  if (sensorLidar && typeof sensorLidar === 'object' && !Array.isArray(sensorLidar)) {
    return sensorLidar
  }
  const summaryLidar = runtime.value.robotSummary?.lidar
  if (summaryLidar && typeof summaryLidar === 'object' && !Array.isArray(summaryLidar)) {
    return summaryLidar
  }
  return null
})

const currentTaskType = computed(() => {
  const taskType = taskRuntimeState.value?.task_type
  return typeof taskType === 'string' ? taskType.trim().toLowerCase() : ''
})

const activePatrolGoal = computed<Record<string, unknown> | null>(() => {
  const goal = navigationRuntimeState.value?.current_goal
  if (goal && typeof goal === 'object' && !Array.isArray(goal)) {
    return goal as Record<string, unknown>
  }

  if (!taskRuntimeState.value) {
    return null
  }

  return {
    name: taskRuntimeState.value.current_waypoint_name ?? null,
    waypoint_index: taskRuntimeState.value.waypoint_index ?? null,
    waypoint_total: taskRuntimeState.value.waypoint_total ?? null,
    lap: taskRuntimeState.value.current_lap ?? null,
  }
})

const activePatrolWaypointIndex = computed(() => {
  const index = parseNumericValue(activePatrolGoal.value?.waypoint_index)
  return index === undefined ? null : Math.max(0, Math.floor(index))
})

const activePatrolWaypointTotal = computed(() => {
  const total = parseNumericValue(activePatrolGoal.value?.waypoint_total)
  return total === undefined ? null : Math.max(0, Math.floor(total))
})

const activePatrolWaypointName = computed(() => {
  const name = activePatrolGoal.value?.name
  return typeof name === 'string' && name.trim() ? name.trim() : null
})

const activePatrolLap = computed(() => {
  const lap = parseNumericValue(activePatrolGoal.value?.lap)
  return lap === undefined ? null : Math.max(1, Math.floor(lap))
})

const isSelectedWaypointRunning = computed(() => {
  const runningFile = taskRuntimeState.value?.waypoint_file
  return currentTaskType.value === 'patrol'
    && typeof runningFile === 'string'
    && !!selectedWaypointFile.value
    && selectedWaypointFile.value.path === runningFile.trim()
})

const patrolMapValidation = computed(() => {
  if (!waypointFileDetail.value) {
    return { type: 'info' as const, message: '' }
  }

  const routeMapName = waypointFileDetail.value.mapName?.trim()
  if (!routeMapName) {
    return {
      type: 'info' as const,
      message: '当前巡逻文件未声明地图名，工作台会按当前定位地图或活动地图执行。',
    }
  }

  if (!selectedMap.value) {
    return {
      type: 'info' as const,
      message: `当前巡逻文件绑定地图 ${routeMapName}。`,
    }
  }

  if (selectedMap.value.name !== routeMapName) {
    return {
      type: 'warning' as const,
      message: `当前画布是 ${selectedMap.value.name}，巡逻文件绑定地图是 ${routeMapName}，路线不会叠加到当前画布。`,
    }
  }

  return {
    type: 'success' as const,
    message: `当前巡逻文件与画布地图 ${routeMapName} 一致。`,
  }
})

const patrolMapValidationType = computed(() => patrolMapValidation.value.type)
const patrolMapValidationMessage = computed(() => patrolMapValidation.value.message)

const navigationFailureReason = computed(() => {
  const reason = navigationRuntimeState.value?.failure_reason
  return typeof reason === 'string' && reason.trim() ? reason.trim() : ''
})

const retryNavigationGoal = computed<NavigationGoal | null>(() => {
  if (!runtime.value.goalPose || currentTaskType.value === 'patrol') {
    return null
  }

  const currentGoal = activePatrolGoal.value ?? {}
  const frameId = extractStringField(currentGoal, ['frame_id', 'frameId']) || navGoalFrameId.value.trim() || 'map'
  const mapName = extractStringField(currentGoal, ['map_name', 'mapName'])
    || navGoalMapName.value.trim()
    || activeMap.value?.name
    || selectedMap.value?.name
    || localizationRuntimeState.value?.map_name
    || null

  return {
    x: runtime.value.goalPose.position[0],
    y: runtime.value.goalPose.position[1],
    yaw: runtime.value.goalPose.yaw,
    frameId,
    mapName,
  }
})

const retryNavigationSummary = computed(() => {
  const goal = retryNavigationGoal.value
  if (!goal) {
    return ''
  }
  return `x=${goal.x.toFixed(3)} m, y=${goal.y.toFixed(3)} m, yaw=${goal.yaw.toFixed(3)} rad, frame=${goal.frameId}`
})

const canRetryFailedNavigation = computed(() => !!navigationFailureReason.value && !!retryNavigationGoal.value && canSendCommand.value)

const robotConnectionItems = computed(() => {
  if (!runtime.value.selectedRobot) {
    return []
  }

  return [
    {
      label: 'WS',
      value: runtime.value.selectedRobot.wsConnected ? '已连' : '未连',
      type: getConnectivityTagType(runtime.value.selectedRobot.wsConnected),
    },
    {
      label: '遥测',
      value: runtime.value.selectedRobot.telemetryOnline ? '在线' : '离线',
      type: getConnectivityTagType(runtime.value.selectedRobot.telemetryOnline === true),
    },
    {
      label: '运行时',
      value: isRuntimeOnline.value ? '在线' : '离线',
      type: getConnectivityTagType(isRuntimeOnline.value),
    },
    {
      label: '雷达',
      value: isLidarOnline.value ? '在线' : '离线',
      type: getConnectivityTagType(isLidarOnline.value),
    },
  ]
})

const isRuntimeOnline = computed(() => {
  if (!runtime.value.selectedRobot || runtime.value.selectedRobot.telemetryOnline !== true) {
    return false
  }

  if (runtime.value.navigationState || runtime.value.mapState || runtime.value.taskState || runtime.value.robotSummary) {
    return true
  }

  const availableTypes = new Set(runtime.value.selectedRobot.telemetryAvailableTypes)
  return ['robot_summary', 'navigation_state', 'map_state', 'task_state', 'sensor_state'].some((item) => availableTypes.has(item))
})

const isLidarOnline = computed(() => lidarRuntimeState.value?.connected === true || lidarRuntimeState.value?.scan_ok === true)

const robotStatusSummaryText = computed(() => {
  if (!runtime.value.selectedRobot) {
    return '未选择机器人'
  }
  if (isRuntimeOnline.value) {
    return '运行时在线'
  }
  if (runtime.value.selectedRobot.telemetryOnline) {
    return '遥测在线'
  }
  return '遥测未知/离线'
})

const robotStatusSummaryType = computed(() => {
  if (!runtime.value.selectedRobot) {
    return 'info' as const
  }
  if (isRuntimeOnline.value) {
    return 'success' as const
  }
  if (runtime.value.selectedRobot.telemetryOnline) {
    return 'warning' as const
  }
  return 'info' as const
})

const navigationPathPolyline = computed(() => {
  const points = extractNavigationPathPoints(navigationRuntimeState.value, currentPose.value, runtime.value.goalPose)
    .map((item) => buildCanvasPoint(item.x, item.y))
    .filter((item): item is { x: number; y: number } => item !== null)

  return buildPolylinePoints(points)
})

const patrolRouteMarkers = computed(() => {
  if (!waypointFileDetail.value || !selectedMap.value || patrolMapValidationType.value === 'warning') {
    return []
  }

  return waypointFileDetail.value.waypoints
    .map((item) => {
      const point = buildCanvasPoint(item.x, item.y)
      if (!point) {
        return null
      }
      return {
        ...point,
        index: item.index,
        active: isSelectedWaypointRunning.value && activePatrolWaypointIndex.value === item.index,
      }
    })
    .filter((item): item is { x: number; y: number; index: number; active: boolean } => item !== null)
})

const patrolRoutePolyline = computed(() => buildPolylinePoints(patrolRouteMarkers.value))

const runtimeOverviewItems = computed(() => [
  {
    label: '建图',
    value: formatRuntimeValue(mapRuntimeState.value?.state),
    type: getStateTagType(mapRuntimeState.value?.state),
  },
  {
    label: '定位',
    value: formatRuntimeValue(localizationRuntimeState.value?.state),
    type: getStateTagType(localizationRuntimeState.value?.state),
  },
  {
    label: '导航',
    value: formatRuntimeValue(navigationRuntimeState.value?.state),
    type: getStateTagType(navigationRuntimeState.value?.state),
  },
  {
    label: '任务',
    value: formatRuntimeValue(taskRuntimeState.value?.state),
    type: getStateTagType(taskRuntimeState.value?.state),
  },
  {
    label: '雷达',
    value: getLidarStatusText(lidarRuntimeState.value),
    type: getLidarTagType(lidarRuntimeState.value),
  },
  {
    label: '运控桥',
    value: getDogBridgeStatusText(dogBridgeRuntimeState.value),
    type: getDogBridgeTagType(dogBridgeRuntimeState.value),
  },
])

const mapDetailItems = computed(() => [
  {
    label: '当前地图',
    value: formatRuntimeValue(mapRuntimeState.value?.current_map ?? activeMap.value?.name),
  },
  {
    label: '最近地图',
    value: formatRuntimeValue(mapRuntimeState.value?.last_map),
  },
  {
    label: '保存目录',
    value: formatRuntimeValue(mapRuntimeState.value?.save_dir ?? runtime.value.mapDirectory),
  },
  {
    label: '定位地图',
    value: formatRuntimeValue(localizationRuntimeState.value?.map_name ?? activeMap.value?.name),
  },
  {
    label: '定位置信度',
    value: formatConfidence(localizationRuntimeState.value?.confidence ?? currentPose.value?.confidence),
  },
  {
    label: '最后命令',
    value: runtime.value.lastCommand ? commandLabelMap[runtime.value.lastCommand] : '暂无',
  },
  {
    label: '最后时间',
    value: runtime.value.lastCommandAt ? formatTime(runtime.value.lastCommandAt) : '暂无',
  },
])

const navigationDetailItems = computed(() => [
  {
    label: '当前目标',
    value: formatGoal(navigationRuntimeState.value?.current_goal),
  },
  {
    label: '剩余距离',
    value: formatDistance(navigationRuntimeState.value?.remaining_distance),
  },
  {
    label: '失败原因',
    value: formatRuntimeValue(navigationRuntimeState.value?.failure_reason),
  },
])

const taskDetailItems = computed(() => [
  {
    label: '任务类型',
    value: formatRuntimeValue(taskRuntimeState.value?.task_type),
  },
  {
    label: '任务 ID',
    value: formatRuntimeValue(taskRuntimeState.value?.task_id),
  },
  {
    label: '任务状态',
    value: formatRuntimeValue(taskRuntimeState.value?.state),
  },
  {
    label: 'SDK 模式',
    value: formatBoolean(runtime.value.robotSummary?.health?.sdk_mode, '开启', '关闭'),
  },
  {
    label: '运动模式',
    value: formatRuntimeValue(runtime.value.robotSummary?.health?.motion_mode),
  },
])

const patrolProgressItems = computed(() => {
  if (currentTaskType.value !== 'patrol') {
    return []
  }

  return [
    {
      label: '当前路点',
      value: activePatrolWaypointName.value || '未上报',
    },
    {
      label: '执行进度',
      value: activePatrolWaypointIndex.value === null || activePatrolWaypointTotal.value === null
        ? '未上报'
        : `${activePatrolWaypointIndex.value + 1} / ${activePatrolWaypointTotal.value}`,
    },
    {
      label: '当前圈数',
      value: activePatrolLap.value === null ? '未上报' : `第 ${activePatrolLap.value} 圈`,
    },
  ]
})

const bridgeDetailItems = computed(() => [
  {
    label: '桥接在线',
    value: formatBoolean(dogBridgeRuntimeState.value?.online, '在线', '离线'),
  },
  {
    label: '运动控制',
    value: formatBoolean(dogBridgeRuntimeState.value?.motion_control_enabled, '启用', '禁用'),
  },
  {
    label: 'SDK 就绪',
    value: formatBoolean(dogBridgeRuntimeState.value?.sdk_ready, '就绪', '未就绪'),
  },
  {
    label: '急停状态',
    value: formatBoolean(dogBridgeRuntimeState.value?.emergency_stop, '已触发', '未触发'),
  },
  {
    label: '裁决原因',
    value: formatDogBridgeReason(dogBridgeRuntimeState.value?.arbitration_reason),
  },
  {
    label: '指令延迟',
    value: formatAgeSeconds(dogBridgeRuntimeState.value?.command_age_sec),
  },
  {
    label: '遥测延迟',
    value: formatAgeSeconds(dogBridgeRuntimeState.value?.telemetry_age_sec),
  },
  {
    label: '目标速度',
    value: formatVelocityTuple(dogBridgeRuntimeState.value?.target_velocity),
  },
  {
    label: '输出速度',
    value: formatVelocityTuple(dogBridgeRuntimeState.value?.output_velocity),
  },
])

const sensorDetailItems = computed(() => [
  {
    label: '雷达连接',
    value: formatBoolean(lidarRuntimeState.value?.connected, '在线', '离线'),
  },
  {
    label: '传输方式',
    value: formatRuntimeValue(lidarRuntimeState.value?.transport),
  },
  {
    label: '坐标系',
    value: formatRuntimeValue(lidarRuntimeState.value?.frame_id),
  },
  {
    label: '扫描状态',
    value: formatBoolean(lidarRuntimeState.value?.scan_ok, '正常', '异常'),
  },
  {
    label: '激光点数',
    value: String(runtime.value.lidarScan?.pointCount || 0),
  },
  {
    label: '扫描时间',
    value: runtime.value.lidarScan ? formatTimestamp(runtime.value.lidarScan.capturedAt) : '暂无',
  },
])

let pollTimer: number | null = null
const { onMessage, connect: wsConnect, disconnect: wsDisconnect } = useWebSocket()
let removeRealtimeHandler: (() => void) | null = null
let waypointDetailRequestSerial = 0

async function refreshAll(): Promise<void> {
  loading.value = true
  try {
    const [mapsResponse, runtimeResponse, robotResponse, waypointResponse] = await Promise.all([
      mappingApi.getMaps(),
      mappingApi.getRuntime(selectedRobotId.value || undefined),
      getRobotList(),
      mappingApi.getWaypoints(),
    ])

    maps.value = mapsResponse.data.maps
    runtime.value = runtimeResponse.data
    robots.value = robotResponse.data.robots
    waypointFiles.value = waypointResponse.data.waypoints
    同步巡逻文件选中状态()

    if (runtime.value.activeMapId && maps.value.some((item) => item.id === runtime.value.activeMapId)) {
      selectedMapId.value = runtime.value.activeMapId
    } else if (!maps.value.some((item) => item.id === selectedMapId.value)) {
      selectedMapId.value = maps.value[0]?.id || ''
    }
  } catch (error) {
    handleRequestError(error, '刷新地图工作台失败')
  } finally {
    loading.value = false
  }
}

async function refreshWaypoints(): Promise<void> {
  loadingWaypoints.value = true
  try {
    const response = await mappingApi.getWaypoints()
    waypointFiles.value = response.data.waypoints
    同步巡逻文件选中状态()
  } catch (error) {
    handleRequestError(error, '刷新巡逻文件失败')
  } finally {
    loadingWaypoints.value = false
  }
}

function 同步巡逻文件选中状态(): void {
  const selectedPath = patrolWaypointFile.value.trim()
  if (!selectedPath) {
    waypointFileDetail.value = null
    return
  }

  if (!waypointFiles.value.some((item) => item.path === selectedPath)) {
    patrolWaypointFile.value = ''
    waypointFileDetail.value = null
    return
  }

  void loadSelectedWaypointDetail()
}

async function loadSelectedWaypointDetail(): Promise<void> {
  const selectedFile = selectedWaypointFile.value
  if (!selectedFile) {
    waypointFileDetail.value = null
    return
  }

  const requestId = ++waypointDetailRequestSerial
  loadingWaypointDetail.value = true
  try {
    const response = await mappingApi.getWaypointDetail(selectedFile.id)
    if (requestId !== waypointDetailRequestSerial) {
      return
    }
    waypointFileDetail.value = response.data.waypoint
  } catch (error) {
    if (requestId !== waypointDetailRequestSerial) {
      return
    }
    waypointFileDetail.value = null
    handleRequestError(error, '读取巡逻文件详情失败')
  } finally {
    if (requestId === waypointDetailRequestSerial) {
      loadingWaypointDetail.value = false
    }
  }
}

async function sendMapCommand(command: MappingCommand, mapId?: string): Promise<void> {
  const payload: {
    type: 'map'
    command: MappingCommand
    mapId?: string
    mapName?: string
  } = {
    type: 'map',
    command,
  }

  if (mapId) {
    payload.mapId = mapId
  }

  const mapName = mapNameInput.value.trim() || selectedMap.value?.name || activeMap.value?.name || ''
  if (mapName) {
    payload.mapName = mapName
  }

  await sendRuntimeCommand(payload)
}

async function sendNavigationCommand(command: NavigationCommand): Promise<void> {
  const payload: {
    type: 'navigation'
    command: NavigationCommand
    goal?: NavigationGoal
  } = {
    type: 'navigation',
    command,
  }

  if (command === 'navigate_to') {
    payload.goal = {
      x: navGoalX.value,
      y: navGoalY.value,
      yaw: navGoalYaw.value,
      frameId: navGoalFrameId.value.trim() || 'map',
      mapName: navGoalMapName.value.trim() || mapNameInput.value.trim() || selectedMap.value?.name || activeMap.value?.name || null,
    }
    pendingGoalAnchor.value = null
  }

  await sendRuntimeCommand(payload)
}

async function sendPatrolCommand(command: PatrolCommand): Promise<void> {
  const payload: {
    type: 'patrol'
    command: PatrolCommand
    taskName?: string
    waypointFile?: string
  } = {
    type: 'patrol',
    command,
  }

  if (command === 'start_patrol') {
    const waypointFile = patrolWaypointFile.value.trim()
    if (!waypointFile) {
      ElMessage.warning('请输入巡逻点位文件')
      return
    }
    payload.waypointFile = waypointFile
    const taskName = patrolTaskName.value.trim()
    if (taskName) {
      payload.taskName = taskName
    }
  }

  await sendRuntimeCommand(payload)
}

async function retryFailedNavigation(): Promise<void> {
  if (!retryNavigationGoal.value) {
    ElMessage.warning('当前没有可重试的导航目标')
    return
  }

  await sendRuntimeCommand({
    type: 'navigation',
    command: 'navigate_to',
    goal: retryNavigationGoal.value,
  })
}

async function sendTaskControl(command: 'pause' | 'resume' | 'terminate'): Promise<void> {
  if (currentTaskType.value === 'patrol') {
    await sendPatrolCommand(command)
    return
  }
  await sendNavigationCommand(command)
}

async function sendRuntimeCommand(payload: Parameters<typeof mappingApi.sendCommand>[0]): Promise<void> {
  try {
    const response = await mappingApi.sendCommand(payload, selectedRobotId.value || undefined)
    runtime.value = response.data
    if (response.data.activeMapId) {
      selectedMapId.value = response.data.activeMapId
    }
    ElMessage.success(buildCommandSuccessMessage(payload, response.data, response.message))
  } catch (error) {
    handleRequestError(error, '命令发送失败')
  }
}

async function openMapDirectory(): Promise<void> {
  openingDirectory.value = true
  try {
    const response = await mappingApi.openMapDirectory()
    ElMessage.success(response.message || '地图目录已打开')
  } catch (error) {
    handleRequestError(error, '打开地图目录失败')
  } finally {
    openingDirectory.value = false
  }
}

async function openWaypointDirectory(): Promise<void> {
  openingWaypointDirectory.value = true
  try {
    const response = await mappingApi.openWaypointDirectory()
    ElMessage.success(response.message || '巡逻目录已打开')
  } catch (error) {
    handleRequestError(error, '打开巡逻目录失败')
  } finally {
    openingWaypointDirectory.value = false
  }
}

function goHome(): void {
  router.push('/')
}

function handleImageLoad(event: Event): void {
  mapImageBroken.value = false
  const target = event.target as HTMLImageElement
  mapImageSize.value = {
    width: target.naturalWidth,
    height: target.naturalHeight,
  }
}

function handleImageError(): void {
  mapImageBroken.value = true
  mapImageSize.value = { width: 0, height: 0 }
}

function handleMapCanvasClick(event: MouseEvent): void {
  const clickedPoint = extractWorldPointFromEvent(event)
  if (!clickedPoint || !selectedMap.value) {
    return
  }

  if (pendingGoalAnchor.value) {
    const deltaX = clickedPoint.x - pendingGoalAnchor.value.x
    const deltaY = clickedPoint.y - pendingGoalAnchor.value.y
    const distance = Math.hypot(deltaX, deltaY)
    if (distance < Math.max(selectedMap.value.resolution, 0.05)) {
      ElMessage.warning('第二次点击距离过近，请点远一点以设置朝向')
      return
    }

    navGoalX.value = Number(pendingGoalAnchor.value.x.toFixed(3))
    navGoalY.value = Number(pendingGoalAnchor.value.y.toFixed(3))
    navGoalYaw.value = Number(Math.atan2(deltaY, deltaX).toFixed(3))
    navGoalMapName.value = selectedMap.value.name
    pendingGoalAnchor.value = null
    showDraftGoal.value = true
    ElMessage.success('已设置导航目标点和朝向')
    return
  }

  navGoalX.value = Number(clickedPoint.x.toFixed(3))
  navGoalY.value = Number(clickedPoint.y.toFixed(3))
  navGoalMapName.value = selectedMap.value.name
  showDraftGoal.value = true
  pendingGoalAnchor.value = {
    x: navGoalX.value,
    y: navGoalY.value,
  }

  if (currentPose.value) {
    navGoalYaw.value = Number(Math.atan2(
      clickedPoint.y - currentPose.value.position[1],
      clickedPoint.x - currentPose.value.position[0],
    ).toFixed(3))
  }

  ElMessage.success('已设置目标点，请再次点击地图确定朝向')
}

function extractWorldPointFromEvent(event: MouseEvent): { x: number; y: number } | null {
  if (!selectedMap.value || !mapImageRef.value || mapImageSize.value.width <= 0 || mapImageSize.value.height <= 0) {
    return null
  }

  const imageRect = mapImageRef.value.getBoundingClientRect()
  if (
    event.clientX < imageRect.left
    || event.clientX > imageRect.right
    || event.clientY < imageRect.top
    || event.clientY > imageRect.bottom
  ) {
    return null
  }

  const xRatio = (event.clientX - imageRect.left) / imageRect.width
  const yRatio = (event.clientY - imageRect.top) / imageRect.height
  const imageX = xRatio * mapImageSize.value.width
  const imageY = yRatio * mapImageSize.value.height
  return {
    x: selectedMap.value.origin[0] + (imageX * selectedMap.value.resolution),
    y: selectedMap.value.origin[1] + ((mapImageSize.value.height - imageY) * selectedMap.value.resolution),
  }
}

function buildPoseStyle(pose: PlanarPose | null, withArrow: boolean): Record<string, string> | null {
  if (!pose || !selectedMap.value || mapImageSize.value.width <= 0 || mapImageSize.value.height <= 0) {
    return null
  }

  const xPixels = (pose.position[0] - selectedMap.value.origin[0]) / selectedMap.value.resolution
  const yPixels = mapImageSize.value.height - ((pose.position[1] - selectedMap.value.origin[1]) / selectedMap.value.resolution)
  const left = (xPixels / mapImageSize.value.width) * 100
  const top = (yPixels / mapImageSize.value.height) * 100

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null
  }

  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: withArrow
      ? `translate(-50%, -50%) rotate(${pose.yaw}rad)`
      : 'translate(-50%, -50%)',
  }
}

function formatOrigin(origin: [number, number, number]): string {
  return `[${origin.map((item) => item.toFixed(2)).join(', ')}]`
}

function formatPose(pose: PlanarPose | null): string {
  if (!pose) {
    return '暂无数据'
  }

  const [x, y] = pose.position
  return `x=${x.toFixed(3)}m, y=${y.toFixed(3)}m, yaw=${pose.yaw.toFixed(3)}rad, 置信度=${pose.confidence.toFixed(2)}`
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString('zh-CN')
}

function formatWaitSeconds(value: number | null): string {
  return value === null ? '未填写' : `${value.toFixed(1)} 秒`
}

function formatWaypointPose(value: { x: number; y: number; yaw: number }): string {
  return `x=${value.x.toFixed(3)} m, y=${value.y.toFixed(3)} m, yaw=${value.yaw.toFixed(3)} rad`
}

function formatAgeSeconds(value: unknown): string {
  const parsed = parseNumericValue(value)
  return parsed === undefined ? '未上报' : `${parsed.toFixed(2)} 秒`
}

function buildCanvasPoint(worldX: number, worldY: number): { x: number; y: number } | null {
  if (!selectedMap.value || mapImageSize.value.width <= 0 || mapImageSize.value.height <= 0) {
    return null
  }

  const xPixels = (worldX - selectedMap.value.origin[0]) / selectedMap.value.resolution
  const yPixels = mapImageSize.value.height - ((worldY - selectedMap.value.origin[1]) / selectedMap.value.resolution)
  if (
    !Number.isFinite(xPixels)
    || !Number.isFinite(yPixels)
    || xPixels < 0
    || yPixels < 0
    || xPixels > mapImageSize.value.width
    || yPixels > mapImageSize.value.height
  ) {
    return null
  }

  return {
    x: xPixels,
    y: yPixels,
  }
}

function buildPolylinePoints(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) {
    return ''
  }

  return points.map((item) => `${item.x},${item.y}`).join(' ')
}

function extractNavigationPathPoints(
  navigationState: Record<string, unknown> | null | undefined,
  pose: PlanarPose | null,
  goalPose: PlanarPose | null,
): Array<{ x: number; y: number }> {
  const runtimePath = collectPathPoints(
    navigationState?.path_points
    ?? navigationState?.planned_path
    ?? navigationState?.path
    ?? navigationState?.trajectory,
  )

  if (runtimePath.length >= 2) {
    return runtimePath
  }

  if (pose && goalPose) {
    return [
      { x: pose.position[0], y: pose.position[1] },
      { x: goalPose.position[0], y: goalPose.position[1] },
    ]
  }

  return []
}

function collectPathPoints(value: unknown): Array<{ x: number; y: number }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => parsePointLike(item))
      .filter((item): item is { x: number; y: number } => item !== null)
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return collectPathPoints(record.points ?? record.path ?? record.poses ?? record.waypoints)
  }

  return []
}

function parsePointLike(value: unknown): { x: number; y: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = parseNumericValue(value[0])
    const y = parseNumericValue(value[1])
    return x === undefined || y === undefined ? null : { x, y }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const x = parseNumericValue(record.x)
  const y = parseNumericValue(record.y)
  if (x !== undefined && y !== undefined) {
    return { x, y }
  }

  const position = record.position
  if (Array.isArray(position) && position.length >= 2) {
    const positionX = parseNumericValue(position[0])
    const positionY = parseNumericValue(position[1])
    return positionX === undefined || positionY === undefined ? null : { x: positionX, y: positionY }
  }

  if (position && typeof position === 'object' && !Array.isArray(position)) {
    const positionRecord = position as Record<string, unknown>
    const positionX = parseNumericValue(positionRecord.x)
    const positionY = parseNumericValue(positionRecord.y)
    return positionX === undefined || positionY === undefined ? null : { x: positionX, y: positionY }
  }

  return null
}

function buildLidarScanPoints(scan: LidarScan | null, pose: PlanarPose | null): Array<{ id: string; x: number; y: number }> {
  if (!scan || !pose || !selectedMap.value || mapImageSize.value.width <= 0 || mapImageSize.value.height <= 0) {
    return []
  }

  const cosYaw = Math.cos(pose.yaw)
  const sinYaw = Math.sin(pose.yaw)
  const points: Array<{ id: string; x: number; y: number }> = []

  for (let index = 0; index < scan.ranges.length; index += 1) {
    const distance = scan.ranges[index]
    if (distance === null || distance < scan.rangeMin || distance > scan.rangeMax) {
      continue
    }

    const angle = scan.angleMin + (index * scan.angleIncrement)
    const localX = distance * Math.cos(angle)
    const localY = distance * Math.sin(angle)
    const worldX = pose.position[0] + (localX * cosYaw) - (localY * sinYaw)
    const worldY = pose.position[1] + (localX * sinYaw) + (localY * cosYaw)
    const xPixels = (worldX - selectedMap.value.origin[0]) / selectedMap.value.resolution
    const yPixels = mapImageSize.value.height - ((worldY - selectedMap.value.origin[1]) / selectedMap.value.resolution)

    if (
      !Number.isFinite(xPixels)
      || !Number.isFinite(yPixels)
      || xPixels < 0
      || yPixels < 0
      || xPixels > mapImageSize.value.width
      || yPixels > mapImageSize.value.height
    ) {
      continue
    }

    points.push({
      id: `${scan.capturedAt}-${index}`,
      x: xPixels,
      y: yPixels,
    })
  }

  return points
}

function buildStandaloneLidarPreviewPoints(scan: LidarScan | null): Array<{ id: string; x: number; y: number }> {
  if (!scan) {
    return []
  }

  const validRanges = scan.ranges.filter((item): item is number => item !== null && item >= scan.rangeMin && item <= scan.rangeMax)
  if (validRanges.length === 0) {
    return []
  }

  const previewRadius = STANDALONE_LIDAR_PREVIEW_HALF * 0.9
  const maxDistance = Math.max(2, Math.min(scan.rangeMax, Math.max(...validRanges) * 1.1))
  const points: Array<{ id: string; x: number; y: number }> = []

  for (let index = 0; index < scan.ranges.length; index += 1) {
    const distance = scan.ranges[index]
    if (distance === null || distance < scan.rangeMin || distance > scan.rangeMax) {
      continue
    }

    const angle = scan.angleMin + (index * scan.angleIncrement)
    const localX = distance * Math.cos(angle)
    const localY = distance * Math.sin(angle)
    const x = STANDALONE_LIDAR_PREVIEW_HALF + ((localX / maxDistance) * previewRadius)
    const y = STANDALONE_LIDAR_PREVIEW_HALF - ((localY / maxDistance) * previewRadius)
    if (x < 0 || y < 0 || x > STANDALONE_LIDAR_PREVIEW_SIZE || y > STANDALONE_LIDAR_PREVIEW_SIZE) {
      continue
    }

    points.push({
      id: `${scan.capturedAt}-${index}`,
      x,
      y,
    })
  }

  return points
}

function handleRequestError(error: unknown, fallbackMessage: string): void {
  console.error(error)
  const maybeAxios = error as {
    response?: {
      data?: {
        message?: string
        error?: string
      }
    }
    message?: string
  }

  const message = maybeAxios.response?.data?.message || maybeAxios.response?.data?.error || maybeAxios.message || fallbackMessage
  ElMessage.error(message)
}

function formatRuntimeValue(value: unknown, fallback = '未上报'): string {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback
  }
  if (typeof value === 'string') {
    return value.trim() || fallback
  }
  return JSON.stringify(value)
}

function formatBoolean(value: unknown, trueText = '开启', falseText = '关闭', fallback = '未上报'): string {
  if (typeof value === 'boolean') {
    return value ? trueText : falseText
  }
  return fallback
}

function extractStringField(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function normalizeDisplayPath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function joinDisplayPath(basePath: string, filename: string): string {
  const trimmedBase = basePath.trim().replace(/[\\/]+$/, '')
  const separator = trimmedBase.includes('\\') ? '\\' : '/'
  return `${trimmedBase}${separator}${filename}`
}

function buildCommandSuccessMessage(
  payload: Parameters<typeof mappingApi.sendCommand>[0],
  data: MappingRuntime,
  fallbackMessage?: string,
): string {
  const mapState = data.mapState ?? data.robotSummary?.mapping ?? null
  if (payload.type === 'map' && payload.command === 'start_mapping') {
    const currentMap = extractStringField(mapState ?? {}, ['current_map'])
    if (currentMap) {
      return `开始建图：${currentMap}`
    }
  }

  if (payload.type === 'map' && payload.command === 'stop_mapping') {
    const lastMap = extractStringField(mapState ?? {}, ['last_map'])
    const saveDir = extractStringField(mapState ?? {}, ['save_dir'])
    if (lastMap && saveDir) {
      return `地图已保存到 ${joinDisplayPath(saveDir, `${lastMap}.yaml`)}`
    }
    if (lastMap) {
      return `地图已保存：${lastMap}`
    }
  }

  return fallbackMessage || '命令已发送'
}

function formatDistance(value: unknown): string {
  const parsed = parseNumericValue(value)
  return parsed === undefined ? '未上报' : `${parsed.toFixed(2)} m`
}

function formatConfidence(value: unknown): string {
  const parsed = parseNumericValue(value)
  if (parsed === undefined) {
    return '未上报'
  }
  if (parsed <= 1) {
    return `${Math.round(parsed * 100)}%`
  }
  return `${Math.round(parsed)}%`
}

function formatGoal(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return formatRuntimeValue(value)
  }
  const goal = value as Record<string, unknown>
  const x = parseNumericValue(goal.x)
  const y = parseNumericValue(goal.y)
  const yaw = parseNumericValue(goal.yaw)
  if (x === undefined || y === undefined || yaw === undefined) {
    return formatRuntimeValue(value)
  }
  const frameId = typeof goal.frame_id === 'string'
    ? goal.frame_id
    : typeof goal.frameId === 'string'
      ? goal.frameId
      : 'map'
  return `x=${x.toFixed(2)}, y=${y.toFixed(2)}, yaw=${yaw.toFixed(2)}, frame=${frameId}`
}

function formatVelocityTuple(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '未上报'
  }
  const velocity = value as Record<string, unknown>
  const vx = parseNumericValue(velocity.vx)
  const vy = parseNumericValue(velocity.vy)
  const wz = parseNumericValue(velocity.wz)
  if (vx === undefined || vy === undefined || wz === undefined) {
    return '未上报'
  }
  return `vx=${vx.toFixed(2)}, vy=${vy.toFixed(2)}, wz=${wz.toFixed(2)}`
}

function formatDogBridgeReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!reason) {
    return '未上报'
  }

  const mapping: Record<string, string> = {
    initializing: '初始化中',
    normal: '正常输出',
    command_timeout: '等待指令',
    telemetry_offline: '遥测离线',
    emergency_stop: '急停中',
    motion_control_disabled: '仅遥测模式',
    sdk_unavailable: 'SDK未就绪',
    control_error: '下发失败',
    telemetry_unavailable: '遥测接口异常',
    bridge_status_missing: '状态未上报',
    unknown: '未知',
  }
  return mapping[reason] || reason
}

function getStateTagType(value: unknown): '' | 'success' | 'warning' | 'info' | 'danger' {
  const state = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!state) return 'info'
  if (['running', 'active', 'connected', 'localizing', 'mapping', 'localized'].includes(state)) return 'success'
  if (['paused', 'warning'].includes(state)) return 'warning'
  if (['error', 'failed', 'aborted', 'cancelled', 'disconnected'].includes(state)) return 'danger'
  return 'info'
}

function getLidarStatusText(value: RuntimeLidarData | null): string {
  if (!value) return '未上报'
  if (value.connected === true && value.scan_ok === true) return '在线'
  if (value.enabled === false) return '未启用'
  if (value.connected === false) return '未连接'
  return '等待数据'
}

function getLidarTagType(value: RuntimeLidarData | null): '' | 'success' | 'warning' | 'info' | 'danger' {
  if (!value) return 'info'
  if (value.connected === true && value.scan_ok === true) return 'success'
  if (value.enabled === false) return 'info'
  if (value.connected === false || value.scan_ok === false) return 'warning'
  return 'info'
}

function getDogBridgeStatusText(value: RuntimeDogBridgeData | null): string {
  if (!value) return '未上报'
  if (value.emergency_stop === true) return '急停中'
  if (value.online !== true) return '未上报'
  if (value.sdk_ready !== true) return 'SDK未就绪'
  if (value.motion_control_enabled === false) return '仅遥测'
  if (value.motion_ready === true) return '就绪'
  return '在线'
}

function getDogBridgeTagType(value: RuntimeDogBridgeData | null): '' | 'success' | 'warning' | 'info' | 'danger' {
  if (!value) return 'info'
  if (value.emergency_stop === true) return 'danger'
  if (value.online !== true) return 'info'
  if (value.sdk_ready !== true || value.motion_control_enabled === false) return 'warning'
  if (value.motion_ready === true) return 'success'
  return 'warning'
}

function getConnectivityTagType(online: boolean): '' | 'success' | 'warning' | 'info' | 'danger' {
  return online ? 'success' : 'danger'
}

function setupRealtimeListener(): void {
  removeRealtimeHandler = onMessage((message: unknown) => {
    if (!message || typeof message !== 'object') {
      return
    }

    const payload = message as {
      type?: string
      data?: {
        robotId?: string
        scan?: LidarScan | null
      }
    }

    if (payload.type !== 'mapping.lidar_scan.updated') {
      return
    }

    const robotId = payload.data?.robotId
    if (!robotId || robotId !== selectedRobotId.value) {
      return
    }

    const scan = payload.data?.scan ?? null
    runtime.value.lidarScan = scan
    if (scan?.pose) {
      runtime.value.currentPose = scan.pose
    }
  })

  wsConnect().catch((error) => {
    console.warn('地图页 WS 连接失败:', error)
  })
}

function cleanupRealtimeListener(): void {
  removeRealtimeHandler?.()
  removeRealtimeHandler = null
  wsDisconnect()
}

onMounted(async () => {
  setupRealtimeListener()
  await refreshAll()
  pollTimer = window.setInterval(() => {
    void refreshAll()
  }, 5000)
})

watch(selectedMapId, () => {
  mapImageBroken.value = false
  mapImageSize.value = { width: 0, height: 0 }
  pendingGoalAnchor.value = null
  showDraftGoal.value = false

  if (!mapNameInput.value.trim() && selectedMap.value?.name) {
    mapNameInput.value = selectedMap.value.name
  }
  if (!navGoalMapName.value.trim() && selectedMap.value?.name) {
    navGoalMapName.value = selectedMap.value.name
  }
})

watch(selectedRobotId, async () => {
  await refreshAll()
})

watch(patrolWaypointFile, (value) => {
  waypointDetailRequestSerial += 1
  loadingWaypointDetail.value = false

  if (!value) {
    waypointFileDetail.value = null
    return
  }

  void loadSelectedWaypointDetail()

  if (patrolTaskName.value.trim() || !value) {
    return
  }

  const normalized = value.replace(/\\/g, '/')
  const filename = normalized.split('/').pop() || normalized
  patrolTaskName.value = filename.replace(/\.[^.]+$/, '')
})

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
  }
  cleanupRealtimeListener()
})
</script>

<style scoped>
.mapping-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 20px;
  box-sizing: border-box;
  background: var(--el-bg-color-page);
  color: var(--studio-text-primary);
  overflow: hidden;
}

.panel {
  border: none;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-toggles {
  margin-right: 4px;
}

.robot-select {
  width: 280px;
}

.robot-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.robot-option small {
  color: var(--studio-text-muted);
}

.workbench-grid {
  --maps-drawer-width: clamp(280px, 20vw, 320px);
  --runtime-drawer-width: clamp(360px, 26vw, 420px);

  display: grid;
  flex: 1;
  grid-template-areas: "maps viewer runtime";
  grid-template-columns: var(--maps-drawer-width) minmax(620px, 1fr) var(--runtime-drawer-width);
  grid-template-rows: minmax(0, 1fr);
  grid-auto-rows: minmax(0, 1fr);
  gap: 18px;
  margin-top: 18px;
  min-height: 0;
  overflow: auto hidden;
  scrollbar-gutter: stable;
}

.workbench-grid.is-maps-collapsed {
  grid-template-areas: "viewer viewer runtime";
}

.workbench-grid.is-runtime-collapsed {
  grid-template-areas: "maps viewer viewer";
}

.workbench-grid.is-maps-collapsed.is-runtime-collapsed {
  grid-template-areas: "viewer viewer viewer";
}

.panel {
  min-height: 0;
  overflow: hidden;
}

.maps-panel {
  grid-area: maps;
}

.viewer-panel {
  grid-area: viewer;
}

.runtime-panel {
  grid-area: runtime;
}

.panel-surface {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid var(--studio-border);
  border-radius: 8px;
  background: var(--studio-panel-background);
  box-shadow: var(--studio-shadow);
  backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 22px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
  flex-shrink: 0;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
}

.panel-header p {
  margin: 8px 0 0;
  color: var(--studio-text-muted);
  line-height: 1.5;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.map-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}

.map-card {
  width: 100%;
  padding: 16px;
  border: 1px solid var(--studio-border);
  border-radius: 20px;
  background: var(--studio-card-background);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.map-card:hover,
.map-card.active {
  transform: translateY(-2px);
  border-color: var(--studio-border-strong);
  box-shadow: var(--studio-shadow-strong);
}

.map-card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.map-card-top strong {
  display: block;
  font-size: 16px;
}

.map-card-top p,
.map-card-meta {
  margin: 6px 0 0;
  color: var(--studio-text-muted);
}

.map-card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
}

.empty-state,
.viewer-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: auto;
}

.empty-description {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.empty-description p {
  margin: 0;
}

.empty-description code {
  max-width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--studio-code-background);
  color: var(--studio-code-text);
  word-break: break-all;
}

.map-source-alert {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.viewer-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.maps-panel,
.runtime-panel {
  position: sticky;
  z-index: 2;
}

.maps-panel {
  left: 0;
}

.runtime-panel {
  right: 0;
}

.canvas-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14px;
  color: var(--studio-text-secondary);
  font-size: 13px;
}

.canvas-legend span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.legend-dot.robot {
  background: #38bdf8;
}

.legend-dot.goal {
  background: #f97316;
}

.legend-dot.lidar {
  background: #22c55e;
}

.legend-dot.nav-path {
  background: #2563eb;
}

.legend-dot.patrol-path {
  background: #f59e0b;
}

.map-stage-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  color: var(--studio-text-muted);
  font-size: 12px;
  word-break: break-all;
  flex-shrink: 0;
}

.canvas-tip {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  line-height: 1.6;
  flex-shrink: 0;
}

.canvas-tip-pending {
  background: rgba(249, 115, 22, 0.14);
  color: #c2410c;
}

.map-canvas-scroll {
  flex: 1;
  min-height: 0;
  padding: 20px;
  border-radius: 24px;
  background: var(--studio-canvas-background);
  background-size: 24px 24px;
  overflow: auto;
}

.map-canvas {
  position: relative;
  display: inline-block;
  max-width: 100%;
  cursor: crosshair;
}

.map-image {
  display: block;
  max-width: min(100%, 1200px);
  height: auto;
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.45);
}

.scan-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.realtime-preview {
  width: min(100%, 620px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  padding: 28px 20px;
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92));
  box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.18);
}

.realtime-preview-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #e2e8f0;
  font-size: 13px;
}

.realtime-preview-header strong {
  font-size: 15px;
  color: #f8fafc;
}

.realtime-preview-canvas {
  width: min(100%, 520px);
  aspect-ratio: 1;
  border-radius: 24px;
  background:
    radial-gradient(circle at center, rgba(14, 116, 144, 0.22), rgba(15, 23, 42, 0.95) 68%),
    linear-gradient(180deg, rgba(8, 47, 73, 0.78), rgba(15, 23, 42, 0.98));
  box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.14);
}

.preview-ring,
.preview-axis {
  fill: none;
  stroke: rgba(148, 163, 184, 0.28);
  stroke-width: 1;
}

.preview-robot {
  fill: #f97316;
  stroke: rgba(255, 237, 213, 0.7);
  stroke-width: 2;
}

.preview-point {
  fill: rgba(34, 211, 238, 0.95);
}

.realtime-preview-tip {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.7;
  text-align: center;
}

.scan-point {
  fill: rgba(34, 197, 94, 0.9);
}

.navigation-route-line {
  fill: none;
  stroke: rgba(37, 99, 235, 0.95);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 10 8;
}

.patrol-route-line {
  fill: none;
  stroke: rgba(245, 158, 11, 0.92);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 6 6;
}

.patrol-route-point {
  fill: rgba(245, 158, 11, 0.9);
  stroke: rgba(255, 251, 235, 0.95);
  stroke-width: 2;
}

.patrol-route-point.active {
  fill: rgba(239, 68, 68, 0.95);
  stroke-width: 3;
}

.pose-marker {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  pointer-events: none;
}

.pose-marker.robot {
  border: 2px solid rgba(186, 230, 253, 0.95);
  background: rgba(14, 165, 233, 0.24);
  box-shadow: 0 0 0 8px rgba(14, 165, 233, 0.12);
}

.pose-arrow {
  position: absolute;
  top: -10px;
  left: 50%;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 16px solid #38bdf8;
  transform: translateX(-50%);
}

.pose-marker.goal {
  border: 3px solid #fed7aa;
  background: rgba(249, 115, 22, 0.24);
  box-shadow: 0 0 0 8px rgba(249, 115, 22, 0.12);
}

.pose-marker.draft-goal {
  border: 2px dashed rgba(251, 146, 60, 0.92);
  background: rgba(251, 146, 60, 0.18);
  box-shadow: 0 0 0 8px rgba(251, 146, 60, 0.1);
}

.pose-arrow-draft {
  border-bottom-color: #f97316;
}

.runtime-panel {
  min-height: 0;
  overflow: hidden;
}

.runtime-panel-scroll {
  flex: 1;
  min-height: 0;
  padding-right: 8px;
  margin-right: -8px;
  overflow: auto;
  scrollbar-gutter: stable;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.overview-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--studio-border);
  border-radius: 16px;
  background: var(--studio-card-background);
}

.overview-chip span {
  color: var(--studio-text-muted);
  font-size: 13px;
}

.command-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.command-grid :last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.form-grid {
  display: grid;
  gap: 10px;
}

.form-grid--goal {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12px;
}

.form-grid__span-2 {
  grid-column: 1 / -1;
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.section-actions--compact {
  margin-top: 10px;
}

.patrol-preview {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--studio-border);
  border-radius: 18px;
  background: var(--studio-card-background);
}

.patrol-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.patrol-preview-header p {
  margin: 6px 0 0;
  color: var(--studio-text-muted);
  font-size: 12px;
  word-break: break-all;
}

.patrol-preview-body {
  margin-top: 12px;
}

.patrol-progress-list {
  margin-top: 12px;
}

.patrol-waypoint-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  max-height: 320px;
  overflow: auto;
}

.patrol-waypoint-card {
  padding: 12px 14px;
  border: 1px solid var(--studio-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.5);
}

.patrol-waypoint-card.active {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(254, 242, 242, 0.9);
  box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.12);
}

.patrol-waypoint-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.patrol-waypoint-card p {
  margin: 8px 0 0;
  color: var(--studio-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--studio-border);
  border-radius: 14px;
  background: var(--studio-card-background);
}

.detail-item span {
  color: var(--studio-text-muted);
  font-size: 13px;
}

.detail-item strong {
  flex: 1;
  text-align: right;
  font-size: 13px;
  word-break: break-all;
}

.runtime-tip {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--studio-info-background);
  color: var(--studio-info-text);
  line-height: 1.6;
}

.runtime-tip-success {
  background: var(--studio-success-background);
  color: var(--studio-success-text);
}

.navigation-error-panel strong {
  display: block;
}

.navigation-error-panel p {
  margin: 8px 0 0;
}

.runtime-section {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--studio-border);
}

.runtime-section h3 {
  margin: 0 0 14px;
  font-size: 16px;
}

.pose-card {
  padding: 14px 16px;
  border: 1px solid var(--studio-border);
  border-radius: 18px;
  background: var(--studio-card-background);
}

.pose-card + .pose-card {
  margin-top: 12px;
}

.pose-title {
  margin: 0 0 8px;
  color: var(--studio-text-muted);
  font-size: 13px;
}

.pose-card p:last-child {
  margin: 0;
  line-height: 1.7;
}

.robot-runtime-card {
  padding: 16px;
  border: 1px solid var(--studio-border);
  border-radius: 18px;
  background: var(--studio-card-background);
}

.robot-connection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.robot-connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--studio-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.52);
}

.robot-connection-item span {
  color: var(--studio-text-muted);
  font-size: 13px;
}

.robot-runtime-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.robot-runtime-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  color: var(--studio-text-muted);
  font-size: 13px;
  word-break: break-all;
}

.runtime-error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--studio-danger-background);
  color: var(--studio-danger-text);
  line-height: 1.6;
}

.telemetry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.history-empty {
  color: var(--studio-text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--studio-card-background);
  border: 1px solid var(--studio-border);
}

.history-item span,
.history-item time {
  color: var(--studio-text-muted);
  font-size: 13px;
}

.runtime-panel :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 1480px) {
  .workbench-grid {
    --maps-drawer-width: 280px;
    --runtime-drawer-width: 380px;
    grid-template-columns: var(--maps-drawer-width) minmax(620px, 1fr) var(--runtime-drawer-width);
  }
}

@media (max-width: 980px) {
  .mapping-workbench {
    height: 100%;
    min-height: 0;
    padding: 16px;
    overflow: hidden;
  }

  .command-grid,
  .overview-grid,
  .form-grid--goal,
  .robot-connection-grid {
    grid-template-columns: 1fr;
  }

  .robot-select {
    width: 100%;
  }

  .header-actions {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .workbench-grid {
    --maps-drawer-width: 260px;
    --runtime-drawer-width: 340px;
    flex: 1;
    grid-template-columns: var(--maps-drawer-width) minmax(520px, 1fr) var(--runtime-drawer-width);
    grid-template-rows: minmax(0, 1fr);
    grid-auto-rows: minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    padding-bottom: 8px;
    overflow: auto hidden;
  }

  .panel-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
