/**
 * 每帧渲染：renderer.render(scenes.active, cameras.active)。
 */

import { Inject, Injectable, type OnDispose, type OnUpdate } from '@threxus/core';
import { WebGLRenderer } from 'three';
import { CameraSystem } from './camera-system';
import { SceneSystem } from './scene-system';

@Injectable()
export class RenderSystem implements OnUpdate, OnDispose {
  @Inject(WebGLRenderer)
  renderer: WebGLRenderer;

  @Inject(SceneSystem)
  scenes: SceneSystem;

  @Inject(CameraSystem)
  cameras: CameraSystem;

  onUpdate(_dt: number): void {
    this.renderer.render(this.scenes.active, this.cameras.active);
  }

  /**
   * 释放 renderer；geometry/material 由各业务 System 在自身 onDispose 中释放。
   */
  onDispose(): void {
    this.renderer.dispose();
    const canvas = this.renderer.domElement;
    canvas.width = 0;
    canvas.height = 0;
  }
}
