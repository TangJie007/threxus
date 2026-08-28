/**
 * GPU 实例化植被/重复模型服务（模式 B）。
 *
 * 全局一个 InstancedMesh；海量实例数据不进 DI。
 */

import { Inject, Injectable, type OnDispose } from '@threxus/core';
import {
  Color,
  InstancedMesh,
  Matrix4,
  Object3D,
  type BufferGeometry,
  type Material,
} from 'three';
import { DisposeService } from './dispose-service';
import { SceneService } from './scene-service';

export type FoliageInstance = {
  position: [number, number, number];
  scale?: number | [number, number, number];
  rotationY?: number;
  color?: [number, number, number];
};

@Injectable()
export class InstancedFoliageService implements OnDispose {
  @Inject(SceneService)
  scenes: SceneService;

  @Inject(DisposeService)
  disposeService: DisposeService;

  private mesh: InstancedMesh | null = null;
  private capacity = 0;

  /**
   * 创建或替换 InstancedMesh 并加入当前场景。
   */
  create(
    geometry: BufferGeometry,
    material: Material,
    instances: readonly FoliageInstance[],
  ): InstancedMesh {
    this.disposeMesh();
    const count = instances.length;
    this.capacity = count;
    this.mesh = new InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = true;

    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < count; i += 1) {
      const inst = instances[i]!;
      dummy.position.set(...inst.position);
      dummy.rotation.set(0, inst.rotationY ?? 0, 0);
      if (typeof inst.scale === 'number') {
        dummy.scale.setScalar(inst.scale);
      } else if (inst.scale) {
        dummy.scale.set(...inst.scale);
      } else {
        dummy.scale.set(1, 1, 1);
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      if (inst.color) {
        color.setRGB(inst.color[0], inst.color[1], inst.color[2]);
        this.mesh.setColorAt(i, color);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }

    this.scenes.attach(this.mesh);
    return this.mesh;
  }

  /** 当前 InstancedMesh（若已 create） */
  getMesh(): InstancedMesh | null {
    return this.mesh;
  }

  /** 更新单个实例矩阵 */
  setMatrixAt(index: number, matrix: Matrix4): void {
    if (!this.mesh || index < 0 || index >= this.capacity) {
      return;
    }
    this.mesh.setMatrixAt(index, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  onDispose(): void {
    this.disposeMesh();
  }

  private disposeMesh(): void {
    if (!this.mesh) {
      return;
    }
    this.scenes.detach(this.mesh);
    this.disposeService.dispose(this.mesh, { recursive: false });
    this.mesh = null;
    this.capacity = 0;
  }
}
