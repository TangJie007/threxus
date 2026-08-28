/**
 * Three 核心模块：Renderer / Scene / Camera / Viewport / Dispose / ECS + 渲染与 resize。
 *
 * 依赖 `@threxus/runtime` 的 `RuntimeModule`（CANVAS 等）。
 * 约定：`WebGLRenderer` 以类本身为 Token；
 * 多场景 / 多机位请注入 {@link SceneService} / {@link CameraService}。
 * 相机位姿请配 {@link THREE_VIEWPORT}，由 {@link ViewportService} 应用；
 * 实体 GPU 资源经 {@link DisposeService}；行为经 {@link EntityComponentService}。
 * `RenderService` 负责 `renderer.dispose()`。
 *
 * 命名：`SceneService` 管 Three **场景图**；core 的 SceneScope 是 DI 子容器。
 */

import { Module } from '@threxus/core';
import { CANVAS, RuntimeModule } from '@threxus/runtime';
import { WebGLRenderer, type WebGLRendererParameters } from 'three';
import { THREE_VIEWPORT } from '../tokens';
import {
  AgentBridgeService,
  AssetService,
  CameraService,
  ClipboardService,
  CommandService,
  ConfigService,
  DisposeService,
  EntityComponentService,
  GizmoService,
  HotkeyService,
  InstancedFoliageService,
  InteractionService,
  RenderService,
  ResizeService,
  SceneService,
  SelectionService,
  SerializeService,
  SnapshotService,
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
    EntityComponentService,
    AssetService,
    SelectionService,
    InteractionService,
    SerializeService,
    CommandService,
    ConfigService,
    InstancedFoliageService,
    GizmoService,
    SnapshotService,
    HotkeyService,
    ClipboardService,
    AgentBridgeService,
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
    EntityComponentService,
    AssetService,
    SelectionService,
    InteractionService,
    SerializeService,
    CommandService,
    ConfigService,
    InstancedFoliageService,
    GizmoService,
    SnapshotService,
    HotkeyService,
    ClipboardService,
    AgentBridgeService,
    RenderService,
    ResizeService,
  ],
})
export class ThreeCoreModule {}
