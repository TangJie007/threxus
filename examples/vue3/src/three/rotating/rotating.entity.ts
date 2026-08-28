/**
 * 旋转立方体实体：外观与运动，不进入 DI。
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
  private readonly speed: { x: number; y: number };

  constructor(options: RotatingOptions = {}) {
    const size = options.size ?? 1;
    this.speed = options.speed ?? { x: 0.8, y: 1.1 };
    this.mesh = new Mesh(
      new BoxGeometry(size, size, size),
      new MeshNormalMaterial(),
    );
    if (options.position) {
      this.mesh.position.set(...options.position);
    }
  }

  update(dt: number): void {
    this.mesh.rotation.x += dt * this.speed.x;
    this.mesh.rotation.y += dt * this.speed.y;
  }

  dispose(): void {
    disposeObject3D(this.mesh, false);
  }
}
