/**
 * 根据画布尺寸同步 renderer 与 camera.aspect。
 */

import { Injectable, type OnDispose, type OnModuleInit } from '@threxus/core';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { CAMERA, WEBGL_RENDERER } from '../tokens';

@Injectable({ inject: [WEBGL_RENDERER, CAMERA] })
export class ResizeSystem implements OnModuleInit, OnDispose {
  private readonly onResize = (): void => {
    this.applySize();
  };

  constructor(
    readonly renderer: WebGLRenderer,
    readonly camera: PerspectiveCamera,
  ) {}

  onModuleInit(): void {
    this.applySize();
    window.addEventListener('resize', this.onResize);
  }

  onDispose(): void {
    window.removeEventListener('resize', this.onResize);
  }

  private applySize(): void {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth || 1;
    const height = parent?.clientHeight || window.innerHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
