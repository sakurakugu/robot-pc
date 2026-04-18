import type { RouteRecordRaw } from 'vue-router'

export const mappingRoutes: RouteRecordRaw[] = [
  {
    path: 'mapping',
    name: 'MappingWorkbench',
    component: () => import('./views/MappingWorkbench.vue'),
    meta: {
      title: '地图工作台',
      description: '查看本地地图、机器人位姿和工作站到真机的地图命令链路。',
    },
  },
]
