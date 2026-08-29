<script setup lang="ts">
import {
  createThreeApp,
  type AppState,
  type RuntimeSnapshot,
} from '@threxus/runtime';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { cubeCamera } from './config';
import { createGltfBoxesFeature } from './features/gltf-boxes';
import { createRotatingBoxFeature } from './features/rotating-box';
import { createSceneFeature } from './features/scene';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const app = shallowRef(
  null as ReturnType<typeof createThreeApp> | null,
);

const events = ref<string[]>([]);
const state = ref<AppState>('created');
const snapshot = ref<RuntimeSnapshot | null>(null);
const error = ref<string | null>(null);
const fps = ref(0);

let lastFrame = 0;
let lastFpsAt = 0;

function log(message: string): void {
  events.value.push(message);
}

function refresh(): void {
  if (!app.value) {
    return;
  }
  state.value = app.value.state;
  snapshot.value = app.value.inspect();

  const frame = snapshot.value.scheduler.frame;
  const now = performance.now();
  if (lastFpsAt === 0) {
    lastFrame = frame;
    lastFpsAt = now;
  } else if (now - lastFpsAt >= 500) {
    fps.value = Math.round(
      ((frame - lastFrame) * 1000) / (now - lastFpsAt),
    );
    lastFrame = frame;
    lastFpsAt = now;
  }
}

onMounted(async () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    error.value = 'Canvas 尚未挂载。';
    return;
  }

  const runtime = createThreeApp({
    canvas,
    camera: cubeCamera,
    // 演示用：引用归零后尽快释放，方便观察 dispose 行为
    assets: { releaseDelayMs: 0 },
  });
  runtime.use(createSceneFeature());
  runtime.use(createRotatingBoxFeature(log));
  runtime.use(createGltfBoxesFeature(log));

  app.value = markRaw(runtime);
  log('调用 app.start()');
  refresh();

  try {
    await runtime.start();
    log('App 启动完成');
    const tick = (): void => {
      refresh();
      if (app.value?.state === 'running') {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
    log(`启动失败：${error.value}`);
    refresh();
  }
});

onBeforeUnmount(() => {
  void app.value?.dispose();
});
</script>

<template>
  <section class="view cube-view">
    <header class="bar">
      <p class="eyebrow">Threxus M5–M9 · WebGL + Assets + GLTF + Input + Pipeline</p>
      <h1>旋转立方体</h1>
      <p class="hint">
        M6：<code>acquireTexture</code> 贴图立方体（上方）；
        M7：<code>acquireGLTF</code> + <code>instantiate</code> 多实例
        （下方，Geometry 共享）；
        M8：点击/悬停上方立方体（<code>ctx.input.on</code>）；
        M9：<code>ctx.rendering.addStage</code> overlay。
      </p>
    </header>

    <div class="demo-grid">
      <article class="panel">
        <div class="status-row">
          <span>App 状态</span>
          <strong :data-state="state">{{ state }}</strong>
        </div>
        <div class="status-row">
          <span>约 FPS</span>
          <strong>{{ fps }}</strong>
        </div>
        <div class="status-row">
          <span>资产条目</span>
          <strong>{{ snapshot?.assets.entries ?? 0 }}</strong>
        </div>
        <div class="status-row">
          <span>资产引用</span>
          <strong>{{ snapshot?.assets.totalRefs ?? 0 }}</strong>
        </div>
        <div class="status-row">
          <span>交互监听</span>
          <strong>{{ snapshot?.input?.listeners ?? 0 }}</strong>
        </div>
        <div class="status-row">
          <span>Pipeline</span>
          <strong>{{ snapshot?.rendering?.pipeline ?? '-' }}</strong>
        </div>
        <div class="status-row">
          <span>RenderStage</span>
          <strong>{{ snapshot?.rendering?.stages ?? 0 }}</strong>
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
