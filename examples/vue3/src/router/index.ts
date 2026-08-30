/** Vue 示例路由：生命周期 / WebGL / 失败回滚。 */

import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: 'Feature 生命周期' },
    },
    {
      path: '/cube',
      name: 'cube',
      component: () => import('../views/cube/index.vue'),
      meta: { title: '旋转立方体' },
    },
    {
      path: '/factory-twin',
      name: 'factory-twin',
      component: () => import('../views/FactoryTwinView.vue'),
      meta: {
        title: '失败回滚',
        description: '验证 Feature 初始化失败后的反向清理',
      },
    },
    {
      path: '/factory',
      name: 'factory',
      component: () => import('../views/factory/index.vue'),
      meta: {
        title: '工厂孪生 · define*',
        description: 'defineService / defineFeature / defineEntity',
      },
    },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Threxus';
  document.title = `${title} · Threxus Vue 3`;
});
