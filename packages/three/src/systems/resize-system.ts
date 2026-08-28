/**
 * 根据画布尺寸同步 renderer，并更新全部已注册相机的 aspect。
 */

import { Inject, Injectable, type OnDispose, type OnModuleInit } from '@threxus/core';
import { WebGLRenderer } from 'three';
import { CameraSystem } from './camera-system';

@Injectable()
export class ResizeSystem implements OnModuleInit, OnDispose {
  @Inject(WebGLRenderer)
  renderer: WebGLRenderer;

  @Inject(CameraSystem)
  cameras: CameraSystem;

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

    const aspect = width / height;
    for (const id of this.cameras.list()) {
      const camera = this.cameras.get(id);
      if (!camera) {
        continue;
      }
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }
}
