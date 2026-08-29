<script setup lang="ts">
import { useThreeApp } from '../composables/use-three-app';
import { createLifecycleFeatures } from '../demo/lifecycle-features';

const {
  canvasRef,
  state,
  events,
  error,
  snapshot,
  dispose,
} = useThreeApp(createLifecycleFeatures);
</script>

<template>
  <section class="view">
    <header class="bar">
      <p class="eyebrow">Threxus M0–M4</p>
      <h1>Feature 生命周期与 Scheduler</h1>
      <p class="hint">
        Consumer 被先注册，但运行时根据 Service 依赖让 Provider 先启动；
        dispose 时按照相反顺序清理。Canvas 上蓝色圆点由 onUpdate 驱动（2D 演示，非 WebGL）。
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
        <div class="status-row">
          <span>Scheduler 帧</span>
          <strong>{{ snapshot?.scheduler.frame ?? 0 }}</strong>
        </div>
        <div class="status-row">
          <span>渲染模式</span>
          <strong>{{ snapshot?.scheduler.renderMode ?? '-' }}</strong>
        </div>
        <button
          type="button"
          :disabled="state === 'disposed'"
          @click="dispose"
        >
          验证反向销毁
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </article>

      <article class="panel">
        <h2>运行记录</h2>
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
