<script setup lang="ts">
import {
  createLogger,
  createThreeApp,
  cameraRigFeature,
  effectComposerFeature,
  environmentFeature,
  highlightFeature,
  inspectRuntime,
  labelsFeature,
  orbitControlsFeature,
  qualityFeature,
  selectionFeature,
  selectionOutlineFeature,
  statsFeature,
  type AppState,
  type DiagnosticSnapshot,
  type GraphicsState,
  type RuntimeSnapshot,
  type RuntimeStats,
} from '@threxus/runtime';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { cubeCamera, cubeSceneConfig } from './config';
import {
  createDemoBridgeFeature,
  type CubeDemoBridge,
} from './features/demo-bridge';
import { createGltfBoxesFeature } from './features/gltf-boxes';
import { createRotatingBoxFeature } from './features/rotating-box';
import { createSceneFeature } from './features/scene';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const app = shallowRef(
  null as ReturnType<typeof createThreeApp> | null,
);

const events = ref<string[]>([]);
const state = ref<AppState>('created');
const graphicsState = ref<GraphicsState>('available');
const snapshot = ref<RuntimeSnapshot | null>(null);
const diagnostics = ref<DiagnosticSnapshot | null>(null);
const error = ref<string | null>(null);
const fps = ref(0);
const selectedNames = ref<string[]>([]);
const latestStats = ref<RuntimeStats | null>(null);
const passRestores = ref(0);
const contextBusy = ref(false);

const bridge: CubeDemoBridge = {
  selection: null,
  stats: null,
  postprocessing: null,
  labels: null,
  cameraRig: null,
  selectedNames: [],
  latestStats: null,
  passRestores: 0,
};

let lastFrame = 0;
let lastFpsAt = 0;

const logger = createLogger({
  level: 'info',
  scope: 'cube',
  sink: (level, message) => {
    events.value.push(`M12 logger[${level}] ${message}`);
  },
});

function log(message: string): void {
  events.value.push(message);
}

function syncBridgeUi(): void {
  selectedNames.value = [...bridge.selectedNames];
  latestStats.value = bridge.latestStats;
  passRestores.value = bridge.passRestores;
}

function refresh(): void {
  if (!app.value) {
    return;
  }
  state.value = app.value.state;
  graphicsState.value = app.value.graphicsState;
  snapshot.value = app.value.inspect();
  diagnostics.value = inspectRuntime(app.value);
  syncBridgeUi();

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

async function simulateLost(): Promise<void> {
  if (!app.value || contextBusy.value) {
    return;
  }
  contextBusy.value = true;
  try {
    log('调用 app.simulateContextLost()');
    app.value.simulateContextLost();
    logger.warn('WebGL context lost (simulated)');
    refresh();
  } finally {
    contextBusy.value = false;
  }
}

async function simulateRestored(): Promise<void> {
  if (!app.value || contextBusy.value) {
    return;
  }
  contextBusy.value = true;
  try {
    log('调用 app.simulateContextRestored()');
    await app.value.simulateContextRestored();
    logger.info('WebGL context restored (simulated)');
    refresh();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    error.value = message;
    log(`Context restore 失败：${message}`);
    refresh();
  } finally {
    contextBusy.value = false;
  }
}

function clearSelection(): void {
  bridge.selection?.clear();
  refresh();
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
    assets: { releaseDelayMs: 0 },
  });

  runtime.use(
    environmentFeature({
      background: cubeSceneConfig.background,
      ambientLight: { intensity: 0.45 },
      directionalLight: {
        color: cubeSceneConfig.lightColor,
        intensity: cubeSceneConfig.lightIntensity,
        position: cubeSceneConfig.lightPosition,
      },
      roomEnvironment: true,
    }),
  );
  runtime.use(
    orbitControlsFeature({
      damping: true,
      target: [0, 0, 0],
    }),
  );
  runtime.use(cameraRigFeature());
  runtime.use(
    effectComposerFeature({
      pipelineName: 'cube-post',
      gtao: true,
      bloom: { strength: 0.25, threshold: 0.9 },
      outline: true,
      fxaa: true,
    }),
  );
  runtime.use(selectionFeature());
  runtime.use(selectionOutlineFeature());
  runtime.use(highlightFeature());
  runtime.use(
    qualityFeature({
      initialTierId: 'medium',
      auto: { enabled: true, targetFps: 50 },
    }),
  );
  runtime.use(statsFeature({ sampleEverySeconds: 0.25 }));
  runtime.use(labelsFeature({ className: 'cube-labels', maxDistance: 40 }));
  runtime.use(createSceneFeature());
  runtime.use(createRotatingBoxFeature(log));
  runtime.use(createGltfBoxesFeature(log));
  runtime.use(createDemoBridgeFeature(bridge, log));

  app.value = markRaw(runtime);
  log('调用 app.start()');
  logger.info('M10–M12 demo bootstrapping');
  refresh();

  try {
    await runtime.start();
    log('App 启动完成');
    logger.info('App running');
    const tick = (): void => {
      refresh();
      if (app.value?.state === 'running' || app.value?.state === 'paused') {
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
      <p class="eyebrow">Threxus M5–M12 · Assets · Input · Pipeline · Context · Built-ins · Diagnostics</p>
      <h1>旋转立方体</h1>
      <p class="hint">
        M6/M7 资产；M8 点击/悬停；M9 overlay；
        M10 模拟 WebGL context lost/restore；
        M11 environment（含 RoomEnvironment）/ orbit / selection / highlight / stats / post / labels；
        M12 <code>createLogger</code> + <code>inspectRuntime</code>。
        拖拽旋转视角；点击场景物体选中高亮并显示 CSS2D 标签。
      </p>
    </header>

    <div class="demo-grid">
      <article class="panel">
        <div class="status-row">
          <span>App 状态</span>
          <strong :data-state="state">{{ state }}</strong>
        </div>
        <div class="status-row">
          <span>Graphics</span>
          <strong :data-graphics="graphicsState">{{ graphicsState }}</strong>
        </div>
        <div class="status-row">
          <span>约 FPS</span>
          <strong>{{ latestStats?.fps ?? fps }}</strong>
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
        <div class="status-row">
          <span>选中</span>
          <strong>{{ selectedNames.length ? selectedNames.join(', ') : '—' }}</strong>
        </div>
        <div class="status-row">
          <span>Pass restore</span>
          <strong>{{ passRestores }}</strong>
        </div>
        <div class="status-row">
          <span>Diagnostics</span>
          <strong :data-healthy="diagnostics?.summary.healthy ?? false">
            {{ diagnostics?.summary.healthy ? 'healthy' : 'issues' }}
          </strong>
        </div>
        <p v-if="diagnostics?.summary.issues.length" class="diag-issues">
          {{ diagnostics.summary.issues.join(' · ') }}
        </p>
        <p v-if="error" class="error">{{ error }}</p>

        <div class="actions">
          <button
            type="button"
            :disabled="contextBusy || graphicsState === 'lost'"
            @click="simulateLost"
          >
            Simulate Context Lost
          </button>
          <button
            type="button"
            :disabled="contextBusy || graphicsState === 'available'"
            @click="simulateRestored"
          >
            Simulate Context Restored
          </button>
          <button
            type="button"
            :disabled="!selectedNames.length"
            @click="clearSelection"
          >
            Clear Selection
          </button>
        </div>
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
        <div class="scene-frame">
          <canvas ref="canvasRef" class="cube-canvas" />
        </div>
        <p class="scene-meta">
          drawCalls {{ latestStats?.drawCalls ?? diagnostics?.renderer?.drawCalls ?? '—' }}
          · tris {{ latestStats?.triangles ?? diagnostics?.renderer?.triangles ?? '—' }}
          · geo {{ latestStats?.geometries ?? diagnostics?.renderer?.geometries ?? '—' }}
          · tex {{ latestStats?.textures ?? diagnostics?.renderer?.textures ?? '—' }}
        </p>
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

.scene-frame {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.actions button {
  padding: 8px 12px;
  color: #e8edf7;
  background: #1a2438;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}

.actions button:hover:not(:disabled) {
  border-color: #5b7cff;
  color: #c5d1ff;
}

.actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.diag-issues {
  margin: 12px 0 0;
  color: #ffb4a8;
  font-size: 0.85rem;
}

.scene-meta {
  margin: 10px 0 0;
  color: #8b97b0;
  font-size: 0.82rem;
}

.status-row strong[data-graphics='lost'],
.status-row strong[data-graphics='unavailable'],
.status-row strong[data-healthy='false'] {
  color: #ff9aab;
}
</style>
