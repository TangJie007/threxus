/**
 * 旋转立方体 System：挂到默认 Scene，销毁时释放 geometry/material。
 */

import {
  Inject,
  Injectable,
  type OnDispose,
  type OnModuleInit,
  type OnUpdate,
} from '@threxus/core';
import {
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
} from 'three';

@Injectable()
export class RotatingCube implements OnModuleInit, OnUpdate, OnDispose {
  @Inject(Scene)
  scene: Scene;

  @Inject(PerspectiveCamera)
  camera: PerspectiveCamera;

  private mesh: Mesh | null = null;

  onModuleInit(): void {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshNormalMaterial();
    this.mesh = new Mesh(geometry, material);
    this.scene.add(this.mesh);
    this.camera.position.set(0, 0.6, 3);
    this.camera.lookAt(0, 0, 0);
  }

  onUpdate(dt: number): void {
    if (!this.mesh) {
      return;
    }
    this.mesh.rotation.x += dt * 0.8;
    this.mesh.rotation.y += dt * 1.1;
  }

  onDispose(): void {
    if (!this.mesh) {
      return;
    }
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      for (const material of this.mesh.material) {
        material.dispose();
      }
    } else {
      this.mesh.material.dispose();
    }
    this.mesh = null;
  }
}
