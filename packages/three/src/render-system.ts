/**
 * 每帧渲染：renderer.render(scene, camera)。
 */

import { Injectable, type OnDispose, type OnUpdate } from '@threxus/core';
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { CAMERA, SCENE, WEBGL_RENDERER } from './tokens';

@Injectable({ inject: [WEBGL_RENDERER, SCENE, CAMERA] })
export class RenderSystem implements OnUpdate, OnDispose {
  constructor(
    readonly renderer: WebGLRenderer,
    readonly scene: Scene,
    readonly camera: PerspectiveCamera,
  ) {}

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
