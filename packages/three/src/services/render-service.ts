/**
 * 每帧渲染：经**同步** Render 中间件链后执行 renderer.render。
 *
 * Render 中间件必须同步；异步逻辑请放 Asset / Interaction 等链。
 */

import { Inject, Injectable, type OnDispose, type OnUpdate } from '@threxus/core';
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import {
  createSyncPipeline,
  type SyncMiddleware,
  type SyncPipeline,
} from '../middleware';
import { CameraService } from './camera-service';
import { SceneService } from './scene-service';

/** Render 流水线上下文 */
export type RenderContext = {
  dt: number;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** 设为 true 可跳过实际 render */
  skipRender?: boolean;
};

@Injectable()
export class RenderService implements OnUpdate, OnDispose {
  @Inject(WebGLRenderer)
  renderer!: WebGLRenderer;

  @Inject(SceneService)
  scenes!: SceneService;

  @Inject(CameraService)
  cameras!: CameraService;

  private readonly middlewares: SyncMiddleware<RenderContext>[] = [];
  private pipeline: SyncPipeline<RenderContext> = createSyncPipeline();

  /**
   * 注册同步 Render 中间件（按注册顺序）。
   */
  use(middleware: SyncMiddleware<RenderContext>): this {
    this.middlewares.push(middleware);
    this.pipeline = createSyncPipeline(this.middlewares);
    return this;
  }

  onUpdate(dt: number): void {
    const ctx: RenderContext = {
      dt,
      renderer: this.renderer,
      scene: this.scenes.active,
      camera: this.cameras.active,
    };
    this.pipeline(ctx, (c) => {
      if (c.skipRender) {
        return;
      }
      c.renderer.render(c.scene, c.camera);
    });
  }

  /**
   * 释放 renderer；场景对象 GPU 资源经 DisposeService。
   */
  onDispose(): void {
    this.renderer.dispose();
    const canvas = this.renderer.domElement;
    canvas.width = 0;
    canvas.height = 0;
  }
}
