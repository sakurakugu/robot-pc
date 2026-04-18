import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { choreoRoutes } from '@/features/choreo/router'
import { mappingRoutes } from '@/features/mapping/router'
import { robotRoutes } from '@/features/robot/router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('./layouts/views/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'StudioHome',
        component: () => import('./views/StudioHome.vue'),
        meta: {
          title: '首页',
          description: '查看电脑端工作站总览，并从这里进入机器人接入、地图工作台和编舞系统。',
        },
      },
      ...robotRoutes,
      ...mappingRoutes,
    ],
  },
  ...choreoRoutes,
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
