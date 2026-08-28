/**
 * 根据画布尺寸同步 renderer 与 camera.aspect。
 */

import { Inject, Injectable, type OnDispose, type OnModuleInit } from '@threxus/core';
import { PerspectiveCamera, WebGLRenderer } from 'three';

@Injectable()
export class ResizeSystem implements OnModuleInit, OnDispose {
  @Inject(WebGLRenderer)
  renderer: WebGLRenderer;

  @Inject(PerspectiveCamera)
  camera: PerspectiveCamera;

  private readonly onResize = (): void => {
    this.applySize();
  };

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
