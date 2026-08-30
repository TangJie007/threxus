<script setup lang="ts">
/**
 * 应用壳：路由导航 + 页面出口。
 */
</script>

<template>
  <main class="page">
    <nav class="nav" aria-label="示例导航">
      <RouterLink class="nav-link" to="/" exact-active-class="on">
        生命周期
      </RouterLink>
      <RouterLink class="nav-link" to="/cube" active-class="on">
        旋转立方体
      </RouterLink>
      <RouterLink class="nav-link" to="/factory-twin" active-class="on">
        失败回滚
      </RouterLink>
      <RouterLink class="nav-link" to="/twin" active-class="on">
        工厂孪生
      </RouterLink>
      <RouterLink class="nav-link" to="/factory" active-class="on">
        工厂 define*
      </RouterLink>
    </nav>
    <RouterView />
  </main>
</template>
