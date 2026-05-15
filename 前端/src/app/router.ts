import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { accountRoutes } from '@/features/account/router'
import { choreoRoutes } from '@/features/choreo/router'
import { developerRoutes } from '@/features/developer/router'
import { mappingRoutes } from '@/features/mapping/router'
import { robotRoutes } from '@/features/robot/router'
import { useAppSettings } from './composables/useAppSettings'

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
          description: '查看电脑端工作站总览，并从这里进入机器狗管理、地图工作台和编舞系统。',
        },
      },
      {
        path: 'settings',
        name: 'AppSettings',
        component: () => import('./views/AppSettings.vue'),
        meta: {
          title: '应用设置',
          description: '配置电脑端工作站应用的本地偏好设置。',
        },
      },
      ...accountRoutes,
      ...robotRoutes,
      ...mappingRoutes,
      ...choreoRoutes,
      ...developerRoutes,
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (!to.meta.requiresDeveloperSettings) {
    return true
  }

  const { developerSettingsEnabled } = useAppSettings()
  if (developerSettingsEnabled.value) {
    return true
  }

  return '/settings'
})
