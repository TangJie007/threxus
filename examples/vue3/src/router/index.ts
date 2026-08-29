/**
 * Vue 示例路由：基础立方体 Demo + FactoryTwin 重构页。
 */

import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { title: '立方体 Demo' },
    },
    {
      path: '/factory-twin',
      name: 'factory-twin',
      component: () => import('../views/FactoryTwinView.vue'),
      meta: {
        title: 'FactoryTwin',
        description: '将 examples/test 的工厂孪生迁到 @threxus/*',
      },
    },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : 'Threxus';
  document.title = `${title} · Threxus Vue 3`;
});
