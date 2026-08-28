/**
 * 旋转立方体 Feature：创建 Mesh、挂组件、进场景。
 * 帧循环由 EntityComponentService 驱动；Mesh 不进 DI。
 */

import { Inject, Injectable, type OnModuleInit } from '@threxus/core';
import {
  disposeObject3D,
  EntityComponentService,
  ObjectHost,
  SceneService,
} from '@threxus/three';
import { BoxGeometry, Mesh, MeshNormalMaterial } from 'three';
import { RotatingComponent } from './rotating.component';

export type RotatingOptions = {
  size?: number;
  position?: [number, number, number];
  speed?: { x: number; y: number };
};

/** 创建立方体 Mesh（原生对象，不进 DI） */
function createCube(options: RotatingOptions = {}): Mesh {
  const size = options.size ?? 1;
  const mesh = new Mesh(
    new BoxGeometry(size, size, size),
    new MeshNormalMaterial(),
  );
  if (options.position) {
    mesh.position.set(...options.position);
  }
  return mesh;
}

@Injectable()
export class RotatingFeature
  extends ObjectHost<Mesh>
  implements OnModuleInit
{
  @Inject(SceneService)
  scenes: SceneService;

  @Inject(EntityComponentService)
  components: EntityComponentService;

  protected attach(mesh: Mesh): void {
    this.scenes.attach(mesh);
  }

  protected detach(mesh: Mesh): void {
    this.components.clear(mesh);
    this.scenes.detach(mesh);
    disposeObject3D(mesh, false);
  }

  spawnCube(options: RotatingOptions = {}): Mesh {
    const mesh = createCube(options);
    this.components.add(
      mesh,
      new RotatingComponent(options.speed ?? { x: 0.8, y: 1.1 }),
    );
    return this.spawn(mesh);
  }

  onModuleInit(): void {
    this.spawnCube({ size: 1, position: [-1.2, 0, 0] });
    this.spawnCube({
      size: 1.6,
      position: [1.4, 0, 0],
      speed: { x: 0.5, y: 0.9 },
    });
  }
}
