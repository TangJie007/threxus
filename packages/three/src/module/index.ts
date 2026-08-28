/**
 * Three 核心模块：Renderer / Scene / CameraSystem + 渲染与 resize。
 *
 * 依赖 `@threxus/runtime` 的 `RuntimeModule`（CANVAS 等）。
 * 约定：以 `WebGLRenderer` / `Scene` 类本身为 Token；
 * `PerspectiveCamera` Token 兼容指向主相机（{@link CameraSystem.MAIN}）；
 * 多机位与当前渲染相机请注入 {@link CameraSystem}。
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
import { CameraSystem, RenderSystem, ResizeSystem } from '../systems';

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
    CameraSystem,
    {
      provide: PerspectiveCamera,
      useFactory: (cameras: CameraSystem) =>
        cameras.get(CameraSystem.MAIN)!,
      inject: [CameraSystem],
    },
    RenderSystem,
    ResizeSystem,
  ],
  exports: [
    WebGLRenderer,
    Scene,
    CameraSystem,
    PerspectiveCamera,
    RenderSystem,
    ResizeSystem,
  ],
})
export class ThreeCoreModule {}
