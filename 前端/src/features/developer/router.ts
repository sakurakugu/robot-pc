import type { RouteRecordRaw } from 'vue-router'

export const developerRoutes: RouteRecordRaw[] = [
  {
    path: 'developer',
    name: 'DeveloperTools',
    component: () => import('./views/DeveloperTools.vue'),
    meta: {
      title: '开发者工具',
      description: '通过 SSH 执行机器狗本体打包、安装和运维任务。',
      requiresDeveloperSettings: true,
    },
  },
]
