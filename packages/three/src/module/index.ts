/**
 * Three 核心模块：Renderer / Scene / Camera + 渲染与 resize。
 *
 * 依赖 `@threxus/runtime` 的 `RuntimeModule`（CANVAS 等）。
 * 约定：以 `WebGLRenderer` / `Scene` / `PerspectiveCamera` 类本身为 Token；
 * 业务侧 mesh 的 geometry/material 在各自 `onDispose` 中释放；
 * `RenderSystem` 负责 `renderer.dispose()`。
 */

import { Module } from '@threxus/core';
import { CANVAS, RuntimeModule } from '@threxus/runtime';
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three';
import { RenderSystem, ResizeSystem } from '../systems';

function createRenderer(canvas: HTMLCanvasElement | null): WebGLRenderer {
  const params: WebGLRendererParameters = {
    antialias: true,
    alpha: true,
  };
  if (canvas) {
    params.canvas = canvas;
  }
  const renderer = new WebGLRenderer(params);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  return renderer;
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 3;
  return camera;
}

@Module({
  imports: [RuntimeModule],
  providers: [
    {
      provide: WebGLRenderer,
      useFactory: (canvas: HTMLCanvasElement | null) => createRenderer(canvas),
      inject: [CANVAS],
    },
    {
      provide: Scene,
      useFactory: () => new Scene(),
    },
    {
      provide: PerspectiveCamera,
      useFactory: () => createCamera(),
    },
    RenderSystem,
    ResizeSystem,
  ],
  exports: [
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    RenderSystem,
    ResizeSystem,
  ],
})
export class ThreeCoreModule {}
