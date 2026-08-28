/**
 * 旋转立方体实体：外观壳，不进 DI；行为由 RotatingComponent 提供。
 */

import { BoxGeometry, Mesh, MeshNormalMaterial } from 'three';
import { disposeObject3D } from '@threxus/three';

/** 创建时的可选属性 */
export type RotatingOptions = {
  size?: number;
  position?: [number, number, number];
  speed?: { x: number; y: number };
};

export class RotatingCube {
  readonly mesh: Mesh;
  readonly speed: { x: number; y: number };

  constructor(options: RotatingOptions = {}) {
    const size = options.size ?? 1;
    this.speed = options.speed ?? { x: 0.8, y: 1.1 };
    this.mesh = new Mesh(
      new BoxGeometry(size, size, size),
      new MeshNormalMaterial(),
    );
    this.mesh.userData.threxusType = 'rotating-cube';
    if (options.position) {
      this.mesh.position.set(...options.position);
    }
  }

  dispose(): void {
    disposeObject3D(this.mesh, false);
  }
}
