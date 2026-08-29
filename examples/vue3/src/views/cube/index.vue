<script setup lang="ts">
import {
  createThreeApp,
  type AppState,
  type RuntimeSnapshot,
} from '@threxus/runtime';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { cubeCamera } from './config';
import { createRotatingBoxFeature } from './features/rotating-box';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const app = shallowRef(
  null as ReturnType<typeof createThreeApp> | null,
);

const events = ref<string[]>([]);
const state = ref<AppState>('created');
const snapshot = ref<RuntimeSnapshot | null>(null);
const error = ref<string | null>(null);

function log(message: string): void {
  events.value.push(message);
}

function refresh(): void {
  if (!app.value) {
    return;
  }
  state.value = app.value.state;
  snapshot.value = app.value.inspect();
}

onMounted(async () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    error.value = 'Canvas 尚未挂载。';
    return;
  }

  // 1. 创建 App，绑定 canvas 和相机
  const runtime = createThreeApp({
    canvas,
    camera: cubeCamera,
  });

  // 2. 注册 Feature（立方体、灯光、旋转逻辑在 features/rotating-box.ts）
  runtime.use(createRotatingBoxFeature(log));

  app.value = markRaw(runtime);
  log('调用 app.start()');
  refresh();

  // 3. 启动运行时
  try {
    await runtime.start();
    log('App 启动完成');
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
    log(`启动失败：${error.value}`);
  }

  refresh();
});

onBeforeUnmount(() => {
  void app.value?.dispose();
});
</script>

<template>
  <section class="view cube-view">
    <header class="bar">
      <p class="eyebrow">Threxus M5 · WebGL</p>
      <h1>旋转立方体</h1>
      <p class="hint">
        学习用最小结构：本页用 <code>&lt;script setup&gt;</code> 直接
        <code>createThreeApp</code>，3D 逻辑在
        <code>features/rotating-box.ts</code>，参数在
        <code>config.ts</code>。
      </p>
    </header>

    <div class="demo-grid">
      <article class="panel">
        <div class="status-row">
          <span>App 状态</span>
          <strong :data-state="state">{{ state }}</strong>
        </div>
        <div class="status-row">
          <span>Scheduler 帧</span>
          <strong>{{ snapshot?.scheduler.frame ?? 0 }}</strong>
        </div>
        <div class="status-row">
          <span>渲染模式</span>
          <strong>{{ snapshot?.scheduler.renderMode ?? '-' }}</strong>
        </div>
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

      <article class="panel scene-panel">
        <h2>WebGL 场景</h2>
        <canvas ref="canvasRef" class="cube-canvas" />
      </article>
    </div>
  </section>
</template>

<style scoped>
.cube-view code {
  color: #9eb4ff;
  font-size: 0.88em;
}

.cube-canvas {
  display: block;
  width: 100%;
  min-height: 320px;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  background: #0b1220;
}
</style>
