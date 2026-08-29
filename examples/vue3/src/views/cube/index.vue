<script lang="ts">
import { defineComponent, markRaw } from 'vue';
import type { AppState, RuntimeSnapshot } from '@threxus/runtime';
import { CubeSession } from './session';

export default defineComponent({
  data() {
    return {
      events: [] as string[],
      state: 'created' as AppState,
      snapshot: null as RuntimeSnapshot | null,
      error: null as string | null,
      session: null as CubeSession | null,
    };
  },
  methods: {
    syncFromSession(): void {
      if (!this.session) {
        return;
      }
      this.state = this.session.state;
      this.snapshot = this.session.snapshot;
      this.error = this.session.error;
    },
    log(message: string): void {
      this.events.push(message);
    },
  },
  async mounted() {
    const canvas = this.$refs.canvas as HTMLCanvasElement | undefined;
    if (!canvas) {
      this.error = 'Canvas 尚未挂载。';
      return;
    }

    this.session = markRaw(
      new CubeSession({
        onLog: (message) => this.log(message),
        onChange: () => this.syncFromSession(),
      }),
    );

    await this.session.mount(canvas);
    this.syncFromSession();
  },
  beforeUnmount() {
    void this.session?.destroy();
  },
});
</script>

<template>
  <section class="view cube-view">
    <header class="bar">
      <p class="eyebrow">Threxus M5 · WebGL</p>
      <h1>旋转立方体</h1>
      <p class="hint">
        本页为独立模块：<code>views/cube/</code> 内包含 Feature、场景配置、
        App 会话与页面，不依赖其他演示路由。
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
        <canvas ref="canvas" class="cube-canvas" />
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
