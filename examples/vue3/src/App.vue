<script setup lang="ts">
/**
 * 页面只负责跑 usage.ts 并显示结果。
 * 调试 @threxus/core 时主要改 src/usage.ts，并看浏览器控制台。
 */
import { run } from './usage';

const message = run();
</script>

<template>
  <main class="page">
    <section class="panel">
      <p class="eyebrow">@threxus/core playground</p>
      <h1>usage.ts</h1>
      <p class="hint">
        编辑 <code>examples/vue3/src/usage.ts</code> 或
        <code>packages/core/src/**</code>，保存后热更新。详情看控制台。
      </p>
      <pre class="output">{{ message }}</pre>
    </section>
  </main>
</template>
