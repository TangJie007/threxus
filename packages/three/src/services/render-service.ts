/**
 * 每帧渲染：经 Render 中间件链后执行 renderer.render。
 */

import { Inject, Injectable, type OnDispose, type OnUpdate } from '@threxus/core';
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import {
  createPipeline,
  type Middleware,
  type Pipeline,
} from '../middleware';
import { CameraService } from './camera-service';
import { SceneService } from './scene-service';

/** Render 流水线上下文 */
export type RenderContext = {
  dt: number;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** 设为 false 可跳过实际 render（短路后仍可调用 next） */
  skipRender?: boolean;
};

@Injectable()
export class RenderService implements OnUpdate, OnDispose {
  @Inject(WebGLRenderer)
  renderer: WebGLRenderer;

  @Inject(SceneService)
  scenes: SceneService;

  @Inject(CameraService)
  cameras: CameraService;

  private readonly middlewares: Middleware<RenderContext>[] = [];
  private pipeline: Pipeline<RenderContext> = createPipeline();

  /**
   * 注册 Render 中间件（按注册顺序）。
   */
  use(middleware: Middleware<RenderContext>): this {
    this.middlewares.push(middleware);
    this.pipeline = createPipeline(this.middlewares);
    return this;
  }

  onUpdate(dt: number): void {
    const ctx: RenderContext = {
      dt,
      renderer: this.renderer,
      scene: this.scenes.active,
      camera: this.cameras.active,
    };
    void this.pipeline(ctx, (c) => {
      if (c.skipRender) {
        return;
      }
      c.renderer.render(c.scene, c.camera);
    });
  }

  /**
   * 释放 renderer；实体 GPU 资源经 DisposeService。
   */
  onDispose(): void {
    this.renderer.dispose();
    const canvas = this.renderer.domElement;
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * @deprecated 使用 {@link RenderService}
 */
export const RenderSystem = RenderService;
