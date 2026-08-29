<script setup lang="ts">
import {
  createThreeApp,
  type AppState,
  type RuntimeSnapshot,
} from '@threxus/runtime';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { demoCamera } from '../demo/config';
import { createLifecycleFeatures } from '../demo/lifecycle-features';

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

async function disposeApp(): Promise<void> {
  if (!app.value || app.value.state === 'disposed') {
    return;
  }

  log('开始 dispose');
  refresh();

  try {
    await app.value.dispose();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }

  refresh();
  log('App 已完整销毁');
}

onMounted(async () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    error.value = 'Canvas 尚未挂载。';
    return;
  }

  const runtime = createThreeApp({
    canvas,
    camera: demoCamera,
  });

  for (const feature of createLifecycleFeatures(log)) {
    runtime.use(feature);
  }

  app.value = markRaw(runtime);
  log('调用 app.start()');
  refresh();

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
  <section class="view">
    <header class="bar">
      <p class="eyebrow">Threxus M0–M3</p>
      <h1>Feature 生命周期</h1>
      <p class="hint">
        Consumer 被先注册，但运行时根据 Service 依赖让 Provider 先启动；
        dispose 时按照相反顺序清理。本页不含 WebGL 场景，立方体见「旋转立方体」路由。
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
        <button
          type="button"
          :disabled="state === 'disposed'"
          @click="disposeApp"
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
