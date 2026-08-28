/**
 * 每帧渲染：renderer.render(scene, cameraSystem.active)。
 */

import { Inject, Injectable, type OnDispose, type OnUpdate } from '@threxus/core';
import { Scene, WebGLRenderer } from 'three';
import { CameraSystem } from './camera-system';

@Injectable()
export class RenderSystem implements OnUpdate, OnDispose {
  @Inject(WebGLRenderer)
  renderer: WebGLRenderer;

  @Inject(Scene)
  scene: Scene;

  @Inject(CameraSystem)
  cameras: CameraSystem;

  onUpdate(_dt: number): void {
    this.renderer.render(this.scene, this.cameras.active);
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
