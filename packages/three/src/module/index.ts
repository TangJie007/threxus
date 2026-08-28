/**
 * Three 核心模块：Renderer / SceneSystem / CameraSystem / Viewport + 渲染与 resize。
 *
 * 依赖 `@threxus/runtime` 的 `RuntimeModule`（CANVAS 等）。
 * 约定：`WebGLRenderer` 以类本身为 Token；
 * `Scene` / `PerspectiveCamera` Token 兼容指向各自 MAIN；
 * 多场景 / 多机位请注入 {@link SceneSystem} / {@link CameraSystem}。
 * 相机位姿请配 {@link THREE_VIEWPORT}，由 {@link ViewportSystem} 应用；
 * 业务侧 mesh 的 geometry/material 在各自 `onDispose` 中释放；
 * `RenderSystem` 负责 `renderer.dispose()`。
 *
 * 命名：`SceneSystem` 管 Three **场景图**；core 的 SceneScope 是 DI 子容器。
 */

import { Module } from '@threxus/core';
import { CANVAS, RuntimeModule } from '@threxus/runtime';
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three';
import { THREE_VIEWPORT } from '../tokens';
import {
  CameraSystem,
  RenderSystem,
  ResizeSystem,
  SceneSystem,
  ViewportSystem,
} from '../systems';

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
    SceneSystem,
    {
      provide: Scene,
      useFactory: (scenes: SceneSystem) => scenes.get(SceneSystem.MAIN)!,
      inject: [SceneSystem],
    },
    CameraSystem,
    {
      provide: PerspectiveCamera,
      useFactory: (cameras: CameraSystem) =>
        cameras.get(CameraSystem.MAIN)!,
      inject: [CameraSystem],
    },
    {
      provide: THREE_VIEWPORT,
      useValue: {},
    },
    ViewportSystem,
    RenderSystem,
    ResizeSystem,
  ],
  exports: [
    WebGLRenderer,
    SceneSystem,
    Scene,
    CameraSystem,
    PerspectiveCamera,
    THREE_VIEWPORT,
    ViewportSystem,
    RenderSystem,
    ResizeSystem,
  ],
})
export class ThreeCoreModule {}
