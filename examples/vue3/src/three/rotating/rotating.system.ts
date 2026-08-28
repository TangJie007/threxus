/**
 * 旋转立方体系统：可多次 spawn，按实例更新与销毁。
 *
 * 本身是 DI 单例；Mesh 由本系统内部持有，不进入容器。
 */

import {
  Inject,
  Injectable,
  type EntitySystem,
} from '@threxus/core';
import {
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  Scene,
} from 'three';

/** spawn 时的可选属性 */
export type RotatingOptions = {
  size?: number;
  position?: [number, number, number];
  speed?: { x: number; y: number };
};

type CubeInstance = {
  mesh: Mesh;
  speed: { x: number; y: number };
};

@Injectable()
export class RotatingSystem implements EntitySystem {
  @Inject(Scene)
  scene: Scene;

  private cubes: CubeInstance[] = [];

  /**
   * 按属性创建一个旋转立方体并加入场景。
   */
  spawn(options: RotatingOptions = {}): Mesh {
    const size = options.size ?? 1;
    const speed = options.speed ?? { x: 0.8, y: 1.1 };
    const geometry = new BoxGeometry(size, size, size);
    const material = new MeshNormalMaterial();
    const mesh = new Mesh(geometry, material);

    if (options.position) {
      mesh.position.set(...options.position);
    }

    this.scene.add(mesh);
    this.cubes.push({ mesh, speed });
    return mesh;
  }

  onModuleInit(): void {
    // 场景编排交给 View；本系统只提供 spawn / 更新能力。
  }

  onUpdate(dt: number): void {
    for (const { mesh, speed } of this.cubes) {
      mesh.rotation.x += dt * speed.x;
      mesh.rotation.y += dt * speed.y;
    }
  }

  onDispose(): void {
    for (const { mesh } of this.cubes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) {
          material.dispose();
        }
      } else {
        mesh.material.dispose();
      }
    }
    this.cubes = [];
  }
}
