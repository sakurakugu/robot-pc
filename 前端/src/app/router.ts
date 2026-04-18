import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { choreoRoutes } from '@/features/choreo/router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/choreo',
  },
  ...choreoRoutes,
  {
    path: '/:pathMatch(.*)*',
    redirect: '/choreo',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
