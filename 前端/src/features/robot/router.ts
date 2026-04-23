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
  {
    path: 'robots/:uuid/operation',
    name: 'RobotOperation',
    component: () => import('./views/RobotOperation.vue'),
    meta: {
      title: '机器人操作',
      description: '通过局域网直连控制机器狗，查看本地视频和基础遥测。',
    },
  },
]
