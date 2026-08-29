/**
 * 旋转组件：挂在 Mesh.userData，由 ComponentService 调度。
 */

import type { Component } from '@threxus/three';
import type { Object3D } from 'three';

export class RotatingComponent implements Component {
  readonly type = 'rotating';

  constructor(readonly speed: { x: number; y: number } = { x: 0.8, y: 1.1 }) {}

  update(dt: number, object: Object3D): void {
    object.rotation.x += dt * this.speed.x;
    object.rotation.y += dt * this.speed.y;
  }
}
