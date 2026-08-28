<script setup lang="ts">
/**
 * Vue 适配：canvas + useThrexus(ThreeAppModule)。
 */
import { ref } from 'vue';
import { useThrexus } from '@threxus/vue';
import { ThreeAppModule } from './three';

const canvasRef = ref<HTMLCanvasElement | null>(null);
useThrexus(ThreeAppModule, canvasRef);
</script>

<template>
  <main class="page">
    <header class="bar">
      <p class="eyebrow">@threxus/vue + three</p>
      <h1>Threxus</h1>
      <p class="hint">功能原子：Module + System + Entity。</p>
    </header>
    <canvas ref="canvasRef" class="viewport" />
  </main>
</template>
