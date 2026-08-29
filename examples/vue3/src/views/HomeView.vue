<script lang="ts">
import { defineComponent, markRaw } from 'vue';
import type { AppState, RuntimeSnapshot } from '@threxus/runtime';
import { createLifecycleFeatures } from '../demo/lifecycle-features';
import { ThreeAppSession } from '../demo/three-app-session';

export default defineComponent({
  data() {
    return {
      events: [] as string[],
      state: 'created' as AppState,
      snapshot: null as RuntimeSnapshot | null,
      error: null as string | null,
      session: null as ThreeAppSession | null,
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
    async disposeApp(): Promise<void> {
      await this.session?.dispose();
      this.syncFromSession();
    },
  },
  async mounted() {
    const canvas = this.$refs.canvas as HTMLCanvasElement | undefined;
    if (!canvas) {
      this.error = 'Canvas 尚未挂载。';
      return;
    }

    this.session = markRaw(
      new ThreeAppSession({
        features: createLifecycleFeatures,
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

    <canvas ref="canvas" class="canvas-placeholder" />
  </section>
</template>
