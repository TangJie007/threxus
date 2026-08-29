<script setup lang="ts">
import {
  createThreeApp,
  type AppState,
  type RuntimeSnapshot,
} from '@threxus/runtime';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { demoCamera } from '../demo/config';
import { createRollbackFeatures } from '../demo/rollback-features';

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

  for (const feature of createRollbackFeatures(log)) {
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
          @click="disposeApp"
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
