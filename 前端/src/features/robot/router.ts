import type { RouteRecordRaw } from 'vue-router'

export const robotRoutes: RouteRecordRaw[] = [
  {
    path: '/robots',
    name: 'RobotAccess',
    component: () => import('./views/RobotAccess.vue'),
    meta: {
      title: '机器人接入',
    },
  },
]
