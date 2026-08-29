<script setup lang="ts">
/**
 * FactoryTwin 重构页：把 examples/test 的工厂数字孪生迁到 @threxus/*。
 * 当前为脚手架；场景逻辑逐步从 test 迁入 three/factory。
 */
import { ref } from 'vue';
import { useThrexus } from '@threxus/vue';
import { FactoryTwinModule } from '../three/factory';

const canvasRef = ref<HTMLCanvasElement | null>(null);
useThrexus(FactoryTwinModule, canvasRef);
</script>

<template>
  <section class="view">
    <header class="bar">
      <p class="eyebrow">refactor · examples/test → @threxus</p>
      <h1>FactoryTwin</h1>
      <p class="hint">
        智能工厂数字孪生：Viewer / Composer / Factory / FX 将按模块迁入 Threxus
        Feature
      </p>
    </header>
    <canvas ref="canvasRef" class="viewport" />
  </section>
</template>
