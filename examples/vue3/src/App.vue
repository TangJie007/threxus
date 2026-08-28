<script setup lang="ts">
/**
 * 跑 usage.ts；组件卸载时 stop，避免热更新泄漏 rAF。
 */
import { onUnmounted } from 'vue';
import { run } from './usage';

const { message, stop } = run();
onUnmounted(stop);
</script>

<template>
  <main class="page">
    <section class="panel">
      <p class="eyebrow">@threxus/core playground</p>
      <h1>usage.ts</h1>
      <p class="hint">
        层级作用域：App 常驻 + Scene A→B 切换。编辑
        <code>usage.ts</code> 或 <code>packages/core/src/**</code>，看控制台。
      </p>
      <pre class="output">{{ message }}</pre>
    </section>
  </main>
</template>
