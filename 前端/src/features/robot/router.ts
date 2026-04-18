import type { RouteRecordRaw } from 'vue-router'

export const robotRoutes: RouteRecordRaw[] = [
  {
    path: 'robots',
    name: 'RobotAccess',
    component: () => import('./views/RobotAccess.vue'),
    meta: {
      title: '机器人接入',
      description: '维护机器人资料、接入地址和工作站侧连接诊断结果。',
    },
  },
]
