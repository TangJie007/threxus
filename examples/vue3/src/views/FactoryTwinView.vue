<script setup lang="ts">
import { useThreeApp } from '../composables/use-three-app';
import { createRollbackFeatures } from '../demo/lifecycle-features';

const {
  canvasRef,
  state,
  events,
  error,
  snapshot,
  dispose,
} = useThreeApp(createRollbackFeatures);
</script>

<template>
  <section class="view">
    <header class="bar">
      <p class="eyebrow">Threxus M3 · failure path</p>
      <h1>失败回滚</h1>
      <p class="hint">
        第二个 Feature 会主动抛出异常。运行时必须先清理它的部分资源，
        再回滚已经启动的 Feature。
      </p>
    </header>

    <div class="demo-grid">
      <article class="panel">
        <div class="status-row">
          <span>App 状态</span>
          <strong :data-state="state">{{ state }}</strong>
        </div>
        <div class="status-row">
          <span>活动服务</span>
          <strong>{{ snapshot?.services ?? 0 }}</strong>
        </div>
        <p class="error">{{ error ?? '等待预期的初始化错误…' }}</p>
        <button
          type="button"
          :disabled="state === 'disposed'"
          @click="dispose"
        >
          完成 App 销毁
        </button>
      </article>

      <article class="panel">
        <h2>回滚记录</h2>
        <ol class="event-log">
          <li v-for="(event, index) in events" :key="index">
            {{ event }}
          </li>
        </ol>
      </article>
    </div>

    <canvas ref="canvasRef" class="canvas-placeholder" />
  </section>
</template>
