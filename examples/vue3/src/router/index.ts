/** Vue 示例路由：M0–M3 生命周期和失败回滚。 */

import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: '生命周期' },
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
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Threxus';
  document.title = `${title} · Threxus Vue 3`;
});
