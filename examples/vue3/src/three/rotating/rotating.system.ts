/**
 * 旋转立方体系统：spawn 实体，驱动 update / dispose。
 *
 * 本身是 DI 单例；实体是普通 class，不进入容器。
 */

import {
  Inject,
  Injectable,
  type EntitySystem,
} from '@threxus/core';
import { CameraSystem } from '@threxus/three';
import { Scene } from 'three';
import { RotatingCube, type RotatingOptions } from './rotating.entity';

export type { RotatingOptions };

@Injectable()
export class RotatingSystem implements EntitySystem {
  @Inject(Scene)
  scene: Scene;

  @Inject(CameraSystem)
  cameras: CameraSystem;

  private cubes: RotatingCube[] = [];

  /**
   * 按属性创建实体并加入场景。
   */
  spawn(options: RotatingOptions = {}): RotatingCube {
    const cube = new RotatingCube(options);
    this.scene.add(cube.mesh);
    this.cubes.push(cube);
    return cube;
  }

  onModuleInit(): void {
    this.spawn({ size: 1, position: [-1.2, 0, 0] });
    this.spawn({
      size: 1.6,
      position: [1.4, 0, 0],
      speed: { x: 0.5, y: 0.9 },
    });

    const camera = this.cameras.active;
    camera.position.set(0, 0.6, 5);
    camera.lookAt(0, 0, 0);
  }

  onUpdate(dt: number): void {
    for (const cube of this.cubes) {
      cube.update(dt);
    }
  }

  onDispose(): void {
    for (const cube of this.cubes) {
      this.scene.remove(cube.mesh);
      cube.dispose();
    }
    this.cubes = [];
  }
}
