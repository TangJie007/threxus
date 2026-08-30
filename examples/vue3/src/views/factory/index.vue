<script setup lang="ts">
/**
 * FactoryTwin（defineFeature / defineEntity + 内置 Feature）。
 */
import {
  createLogger,
  createThreeApp,
  cameraRigFeature,
  effectComposerFeature,
  environmentFeature,
  labelsFeature,
  orbitControlsFeature,
  qualityFeature,
  selectionFeature,
  selectionOutlineFeature,
  statsFeature,
  type AppState,
  type RuntimeStats,
} from '@threxus/runtime';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { markRaw, onBeforeUnmount, onMounted, ref, shallowReactive, shallowRef } from 'vue';
import { factoryCamera, factoryRoamPath, factorySceneConfig } from './config';
import { factorySceneFeature } from './factory/factory.feature';
import { clipFeature } from './clip/clip.feature';
import { agvFeature } from './agv/agv.feature';
import { createBridgeFeature } from './bridge/bridge.feature';
import { statusText, type DeviceRecord } from './data/devices';
import type { FactoryBridge, FactoryToggles } from './types';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const labelHostRef = ref<HTMLDivElement | null>(null);
const app = shallowRef(null as ReturnType<typeof createThreeApp> | null);

const state = ref<AppState>('created');
const error = ref<string | null>(null);
const loading = ref(true);

const bridge = shallowReactive<FactoryBridge>({
  scene: null,
  selection: null,
  stats: null,
  composer: null,
  labels: null,
  cameraRig: null,
  devices: [],
  selectedId: null,
  cameraMode: 'orbit',
  toggles: {
    outline: true,
    bloom: true,
    ao: true,
    flow: true,
    fence: false,
    clip: false,
    labels: true,
  },
  kpi: { run: 0, warn: 0, error: 0, oee: 0 },
  latestStats: null,
  ready: false,
  focusDevice: () => undefined,
  clearSelection: () => undefined,
  setCameraMode: () => undefined,
  setToggle: () => undefined,
  hoverPreview: () => undefined,
});

const logger = createLogger({ level: 'warn', scope: 'factory' });

function selectedDevice(): DeviceRecord | undefined {
  return bridge.devices.find((d) => d.id === bridge.selectedId);
}

function toggle(key: keyof FactoryToggles): void {
  bridge.setToggle(key, !bridge.toggles[key]);
}

function formatStats(stats: RuntimeStats | null): string {
  if (!stats) return '—';
  return `FPS ${stats.fps} · Draw ${stats.drawCalls} · Tri ${stats.triangles} · Geo ${stats.geometries} · Tex ${stats.textures}`;
}

onMounted(async () => {
  const canvas = canvasRef.value;
  const labelHost = labelHostRef.value;
  if (!canvas || !labelHost) {
    error.value = 'Canvas / label host 尚未挂载。';
    loading.value = false;
    return;
  }

  const runtime = createThreeApp({
    canvas,
    camera: factoryCamera,
    renderer: {
      antialias: true,
      shadows: true,
      outputColorSpace: SRGBColorSpace,
      toneMapping: ACESFilmicToneMapping,
      toneMappingExposure: 1.05,
    },
    pixelRatio: { mode: 'device', max: 2 },
    input: {
      layersMask: 1 << 1,
      clickMoveTolerance: 5,
      pointerMoveThrottleMs: 0,
    },
    assets: { releaseDelayMs: 0 },
    diagnostics: {
      logger,
      lifecycleWarnings: true,
    },
  });

  runtime.use(
    environmentFeature({
      background: factorySceneConfig.background,
      ambientLight: { intensity: factorySceneConfig.ambientIntensity },
      directionalLight: {
        color: 0xfff2e0,
        intensity: factorySceneConfig.sunIntensity,
        position: factorySceneConfig.sunPosition,
        castShadow: true,
      },
      roomEnvironment: { sigma: 0.04 },
      shadows: {
        enabled: true,
        mapSize: 2048,
        fitBounds: factorySceneConfig.bounds,
      },
    }),
  );
  runtime.use(
    orbitControlsFeature({
      damping: true,
      target: [0, 2, 0],
    }),
  );
  runtime.use(
    cameraRigFeature({
      roamPath: factoryRoamPath,
      roamLookRadius: 10,
      roamSpeed: 0.012,
    }),
  );
  runtime.use(
    effectComposerFeature({
      pipelineName: 'factory-post',
      gtao: { blendIntensity: 0.85 },
      bloom: { strength: 0.28, threshold: 0.82, radius: 0.4 },
      outline: {
        edgeStrength: 3.2,
        edgeGlow: 0.4,
        edgeThickness: 1.4,
        visibleEdgeColor: 0x40e0ff,
        hiddenEdgeColor: 0x1a6070,
      },
      fxaa: true,
    }),
  );
  runtime.use(selectionFeature());
  runtime.use(selectionOutlineFeature());
  runtime.use(
    qualityFeature({
      initialTierId: 'high',
      auto: { enabled: false },
    }),
  );
  runtime.use(statsFeature({ sampleEverySeconds: 0.25 }));
  runtime.use(
    labelsFeature({
      container: labelHost,
      className: 'factory-labels',
      maxDistance: 55,
      occludedOpacity: 0.2,
    }),
  );
  runtime.use(factorySceneFeature);
  runtime.use(clipFeature);
  runtime.use(agvFeature);
  runtime.use(createBridgeFeature(bridge));

  app.value = markRaw(runtime);
  state.value = runtime.state;

  try {
    await runtime.start();
    state.value = runtime.state;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
    state.value = runtime.state;
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  void app.value?.dispose();
});
</script>

<template>
  <section class="factory-view">
    <div class="canvas-host">
      <canvas ref="canvasRef" class="factory-canvas" />
      <div ref="labelHostRef" class="label-host" />
    </div>

    <div class="hud topbar">
      <div class="brand">
        <i class="dot" />
        FactoryTwin
        <small>DEFINE* · Threxus</small>
      </div>
      <div class="spacer" />
      <div class="kpi">
        <div class="item">
          <b>{{ bridge.kpi.run }}</b>
          <span>运行中</span>
        </div>
        <div class="item">
          <b class="warn">{{ bridge.kpi.warn }}</b>
          <span>告警</span>
        </div>
        <div class="item">
          <b class="err">{{ bridge.kpi.error }}</b>
          <span>故障</span>
        </div>
        <div class="item">
          <b>{{ bridge.kpi.oee }}%</b>
          <span>综合效率</span>
        </div>
      </div>
    </div>

    <aside class="hud panel panel-left">
      <h3>
        设备清单
        <em>{{ bridge.devices.length }} 台</em>
      </h3>
      <div class="device-list">
        <button
          v-for="d in bridge.devices"
          :key="d.id"
          type="button"
          class="dev"
          :class="{ active: bridge.selectedId === d.id }"
          @click="bridge.focusDevice(d.id)"
          @mouseenter="bridge.hoverPreview(d.id)"
          @mouseleave="bridge.hoverPreview(null)"
        >
          <i class="led" :class="`led-${d.status}`" />
          <span class="name">{{ d.name }}</span>
          <span class="val">{{ d.metrics.temp.toFixed(0) }}℃</span>
        </button>
      </div>
    </aside>

    <aside
      v-if="selectedDevice()"
      class="hud panel panel-right"
    >
      <h3>
        设备详情
        <em class="close" @click="bridge.clearSelection()">✕</em>
      </h3>
      <div class="detail-body">
        <div class="kv">
          <span>设备编号</span>
          <b>{{ selectedDevice()!.id }}</b>
        </div>
        <div class="kv">
          <span>所属产线</span>
          <b>{{ selectedDevice()!.line }}</b>
        </div>
        <div class="kv">
          <span>设备类型</span>
          <b>{{ selectedDevice()!.type }}</b>
        </div>
        <div class="kv">
          <span>运行状态</span>
          <b :class="`s-${selectedDevice()!.status}`">
            {{ statusText(selectedDevice()!.status) }}
          </b>
        </div>
        <div class="kv">
          <span>主轴温度</span>
          <b>{{ selectedDevice()!.metrics.temp.toFixed(1) }} ℃</b>
        </div>
        <div class="kv">
          <span>转速</span>
          <b>{{ selectedDevice()!.metrics.speed }} rpm</b>
        </div>
        <div class="kv">
          <span>当班产量</span>
          <b>{{ selectedDevice()!.metrics.output }} 件</b>
        </div>
        <div class="kv">
          <span>振动</span>
          <b>{{ selectedDevice()!.metrics.vibration.toFixed(2) }} mm/s</b>
        </div>
        <div class="load">
          <div class="load-head">
            <span>负载率</span>
            <b>{{ selectedDevice()!.metrics.load }}%</b>
          </div>
          <div class="bar">
            <i :style="{ width: `${selectedDevice()!.metrics.load}%` }" />
          </div>
        </div>
      </div>
    </aside>

    <div class="hud toolbar">
      <button
        type="button"
        :class="{ on: bridge.cameraMode === 'orbit' }"
        @click="bridge.setCameraMode('orbit')"
      >
        环绕
      </button>
      <button
        type="button"
        :class="{ on: bridge.cameraMode === 'roam' }"
        @click="bridge.setCameraMode('roam')"
      >
        巡检
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.outline }"
        @click="toggle('outline')"
      >
        描边
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.bloom }"
        @click="toggle('bloom')"
      >
        辉光
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.ao }"
        @click="toggle('ao')"
      >
        AO
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.flow }"
        @click="toggle('flow')"
      >
        流向
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.fence }"
        @click="toggle('fence')"
      >
        围栏
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.clip }"
        @click="toggle('clip')"
      >
        剖切
      </button>
      <button
        type="button"
        :class="{ on: bridge.toggles.labels }"
        @click="toggle('labels')"
      >
        标签
      </button>
    </div>

    <div class="hud statusbar">
      <span>{{ formatStats(bridge.latestStats) }}</span>
      <span class="dim">App {{ state }}</span>
    </div>

    <div v-if="loading" class="loading">
      <div class="ring" />
      <p>正在构建孪生场景（define*）…</p>
    </div>
    <p v-if="error" class="boot-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.factory-view {
  --bg: #0a0f16;
  --panel: rgba(12, 20, 30, 0.82);
  --line: rgba(64, 224, 255, 0.18);
  --cyan: #40e0ff;
  --ok: #2ee6a8;
  --warn: #ffb020;
  --err: #ff4d5e;
  --idle: #7d8ea3;
  --text: #d6e4f0;
  --dim: #7d8ea3;
  position: relative;
  min-height: calc(100vh - 48px);
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.6 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.canvas-host {
  position: absolute;
  inset: 0;
}

.factory-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}

.label-host {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.hud {
  position: absolute;
  pointer-events: none;
  z-index: 10;
}

.hud > * {
  pointer-events: auto;
}

.topbar {
  top: 0;
  left: 0;
  right: 0;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 18px;
  background: linear-gradient(180deg, rgba(8, 14, 22, 0.94), rgba(8, 14, 22, 0));
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.brand .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 12px var(--cyan);
  animation: pulse 2s infinite;
}

.brand small {
  color: var(--dim);
  font-weight: 400;
  letter-spacing: 2px;
}

.spacer {
  flex: 1;
}

.kpi {
  display: flex;
  gap: 22px;
}

.kpi .item {
  text-align: right;
}

.kpi .item b {
  display: block;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}

.kpi .item span {
  font-size: 11px;
  color: var(--dim);
}

.kpi .warn {
  color: var(--warn);
}

.kpi .err {
  color: var(--err);
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

.panel h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  padding: 10px 14px;
  color: var(--cyan);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel h3 em {
  font-style: normal;
  color: var(--dim);
  font-size: 11px;
}

.panel h3 .close {
  cursor: pointer;
}

.panel-left {
  top: 66px;
  left: 14px;
  width: 244px;
  max-height: calc(100% - 140px);
  display: flex;
  flex-direction: column;
}

.device-list {
  overflow-y: auto;
  padding: 6px;
}

.dev {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 9px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.dev:hover {
  background: rgba(64, 224, 255, 0.08);
}

.dev.active {
  background: rgba(64, 224, 255, 0.14);
  border-color: var(--line);
}

.dev .led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.dev .name {
  flex: 1;
  font-size: 12px;
}

.dev .val {
  font-size: 11px;
  color: var(--dim);
  font-variant-numeric: tabular-nums;
}

.panel-right {
  top: 66px;
  right: 14px;
  width: 258px;
}

.detail-body {
  padding: 12px 14px;
}

.kv {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px dashed rgba(125, 142, 163, 0.18);
}

.kv:last-child {
  border: 0;
}

.kv span {
  color: var(--dim);
  font-size: 12px;
}

.kv b {
  font-weight: 600;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.load {
  margin-top: 10px;
}

.load-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--dim);
}

.load-head b {
  color: var(--text);
}

.bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(125, 142, 163, 0.25);
  overflow: hidden;
  margin-top: 4px;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--cyan);
  transition: width 0.4s ease;
}

.toolbar {
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  padding: 6px;
  pointer-events: auto;
  background: #111827;
  border: 1px solid #273249;
  border-radius: 12px;
}

.toolbar button {
  background: transparent;
  border: 1px solid transparent;
  color: var(--dim);
  padding: 6px 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.15s;
  margin-top: 0;
}

.toolbar button:hover {
  color: var(--text);
  background: rgba(64, 224, 255, 0.08);
}

.toolbar button.on {
  color: var(--cyan);
  border-color: var(--line);
  background: rgba(64, 224, 255, 0.12);
}

.statusbar {
  bottom: 14px;
  left: 14px;
  font-size: 11px;
  color: var(--dim);
  display: flex;
  gap: 14px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.statusbar .dim {
  opacity: 0.7;
}

.led-ok {
  background: var(--ok);
  box-shadow: 0 0 8px var(--ok);
}
.led-warn {
  background: var(--warn);
  box-shadow: 0 0 8px var(--warn);
}
.led-err {
  background: var(--err);
  box-shadow: 0 0 8px var(--err);
}
.led-idle {
  background: var(--idle);
}

.s-ok {
  color: var(--ok);
}
.s-warn {
  color: var(--warn);
}
.s-err {
  color: var(--err);
}
.s-idle {
  color: var(--idle);
}

.loading {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading .ring {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid rgba(64, 224, 255, 0.15);
  border-top-color: var(--cyan);
  animation: spin 0.9s linear infinite;
}

.loading p {
  color: var(--dim);
  font-size: 12px;
  letter-spacing: 1px;
}

.boot-error {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 110;
  padding: 10px 16px;
  background: rgba(255, 77, 94, 0.15);
  border: 1px solid var(--err);
  border-radius: 8px;
  color: #ffb0b8;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style>
.factory-labels .tag,
.label-host .tag {
  transform: translate(-50%, -50%);
  white-space: nowrap;
  padding: 3px 9px 3px 7px;
  font-size: 11px;
  line-height: 1.4;
  border-radius: 4px;
  background: rgba(8, 16, 24, 0.86);
  border: 1px solid rgba(64, 224, 255, 0.18);
  color: #d6e4f0;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
  position: relative;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.factory-labels .tag .led,
.label-host .tag .led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.factory-labels .tag::after,
.label-host .tag::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -14px;
  width: 1px;
  height: 14px;
  background: linear-gradient(180deg, #40e0ff, transparent);
  transform: translateX(-50%);
}

.factory-labels .s-ok,
.label-host .s-ok {
  color: #2ee6a8;
}
.factory-labels .s-ok .led,
.label-host .s-ok .led {
  background: #2ee6a8;
  box-shadow: 0 0 8px #2ee6a8;
}
.factory-labels .s-warn,
.label-host .s-warn {
  color: #ffb020;
}
.factory-labels .s-warn .led,
.label-host .s-warn .led {
  background: #ffb020;
  box-shadow: 0 0 8px #ffb020;
}
.factory-labels .s-err,
.label-host .s-err {
  color: #ff4d5e;
}
.factory-labels .s-err .led,
.label-host .s-err .led {
  background: #ff4d5e;
  box-shadow: 0 0 8px #ff4d5e;
}
.factory-labels .s-idle,
.label-host .s-idle {
  color: #7d8ea3;
}
.factory-labels .s-idle .led,
.label-host .s-idle .led {
  background: #7d8ea3;
}
</style>
