<script setup lang="ts">
/**
 * 基础示例：旋转立方体，演示 AppModule · Feature · Component。
 */
import { ref } from 'vue';
import { useThrexus } from '@threxus/vue';
import { ThreeAppModule } from '../three';

const canvasRef = ref<HTMLCanvasElement | null>(null);
useThrexus(ThreeAppModule, canvasRef);
</script>

<template>
  <section class="view">
    <header class="bar">
      <p class="eyebrow">@threxus/vue + three</p>
      <h1>Threxus</h1>
      <p class="hint">AppModule · Feature · Component · ObjectHost</p>
    </header>
    <canvas ref="canvasRef" class="viewport" />
  </section>
</template>
