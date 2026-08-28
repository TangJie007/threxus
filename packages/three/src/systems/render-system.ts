/**
 * 每帧渲染：renderer.render(scene, camera)。
 */

import { Inject, Injectable, type OnDispose, type OnUpdate } from '@threxus/core';
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

@Injectable()
export class RenderSystem implements OnUpdate, OnDispose {
  @Inject(WebGLRenderer)
  renderer: WebGLRenderer;

  @Inject(Scene)
  scene: Scene;

  @Inject(PerspectiveCamera)
  camera: PerspectiveCamera;

  onUpdate(_dt: number): void {
    this.renderer.render(this.scene, this.camera);
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
