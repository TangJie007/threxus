/**
 * Three 核心模块：渲染闭环所需的最小服务集。
 *
 * 包含：Renderer / Scene / Camera / Viewport / Dispose / Component / Render / Resize。
 * 资源、交互、序列化、编辑器等请按需 imports 可选模块。
 *
 * 依赖 `@threxus/runtime` 的 `RuntimeModule`（CANVAS 等）。
 * `SceneService` 管 Three **场景图**；core 的 SceneScope 是 DI 子容器。
 */

import { Module } from '@threxus/core';
import { CANVAS, RuntimeModule } from '@threxus/runtime';
import { WebGLRenderer, type WebGLRendererParameters } from 'three';
import { THREE_VIEWPORT } from '../tokens';
import {
  CameraService,
  ComponentService,
  DisposeService,
  RenderService,
  ResizeService,
  SceneService,
  ViewportService,
} from '../services';

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
    SceneService,
    CameraService,
    {
      provide: THREE_VIEWPORT,
      useValue: {},
    },
    ViewportService,
    DisposeService,
    ComponentService,
    RenderService,
    ResizeService,
  ],
  exports: [
    WebGLRenderer,
    SceneService,
    CameraService,
    THREE_VIEWPORT,
    ViewportService,
    DisposeService,
    ComponentService,
    RenderService,
    ResizeService,
  ],
})
export class ThreeCoreModule {}
