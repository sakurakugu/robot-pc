import type { RouteRecordRaw } from 'vue-router'

export const robotRoutes: RouteRecordRaw[] = [
  {
    path: 'robots',
    name: 'RobotAccess',
    component: () => import('./views/RobotAccess.vue'),
    meta: {
      title: '机器狗管理',
      description: '像手机端一样统一管理机器狗资料，并在详情里查看接入诊断。',
    },
  },
]
