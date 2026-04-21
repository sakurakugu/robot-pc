import type { RouteRecordRaw } from 'vue-router'

export const accountRoutes: RouteRecordRaw[] = [
  {
    path: 'account',
    name: 'CloudAccount',
    component: () => import('./views/CloudAccount.vue'),
    meta: {
      title: '个人中心',
      description: '配置云端地址，登录账号，并管理当前账号和登录设备。',
    },
  },
]
