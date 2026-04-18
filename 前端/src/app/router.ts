import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { choreoRoutes } from '@/features/choreo/router'
import { mappingRoutes } from '@/features/mapping/router'
import { robotRoutes } from '@/features/robot/router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'StudioHome',
    component: () => import('./views/StudioHome.vue'),
  },
  ...choreoRoutes,
  ...mappingRoutes,
  ...robotRoutes,
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
