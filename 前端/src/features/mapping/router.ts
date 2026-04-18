import type { RouteRecordRaw } from 'vue-router'

export const mappingRoutes: RouteRecordRaw[] = [
  {
    path: '/mapping',
    name: 'MappingWorkbench',
    component: () => import('./views/MappingWorkbench.vue'),
    meta: {
      title: '地图工作台',
    },
  },
]
