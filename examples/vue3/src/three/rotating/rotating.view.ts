/**
 * 旋转立方体视图：编排相机与若干立方体实例。
 */

import { Inject, Injectable, type OnModuleInit } from '@threxus/core';
import { PerspectiveCamera } from 'three';
import { RotatingSystem } from './rotating.system';

@Injectable()
export class RotatingView implements OnModuleInit {
  @Inject(RotatingSystem)
  cubes: RotatingSystem;

  @Inject(PerspectiveCamera)
  camera: PerspectiveCamera;

  onModuleInit(): void {
    this.cubes.spawn({ size: 1, position: [-1.2, 0, 0] });
    this.cubes.spawn({
      size: 1.6,
      position: [1.4, 0, 0],
      speed: { x: 0.5, y: 0.9 },
    });

    this.camera.position.set(0, 0.6, 5);
    this.camera.lookAt(0, 0, 0);
  }
}
