/**
 * 旋转组件：挂在 Mesh.userData，由 ComponentService 调度。
 */

import { createComponentType, type Component } from '@threxus/three';
import type { Object3D } from 'three';

/** 旋转组件类型键（symbol，避免字符串拼写冲突） */
export const ROTATING = createComponentType('rotating');

export class RotatingComponent implements Component {
  readonly type = ROTATING;

  constructor(readonly speed: { x: number; y: number } = { x: 0.8, y: 1.1 }) {}

  update(dt: number, object: Object3D): void {
    object.rotation.x += dt * this.speed.x;
    object.rotation.y += dt * this.speed.y;
  }
}
