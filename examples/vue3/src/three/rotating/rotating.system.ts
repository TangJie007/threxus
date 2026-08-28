/**
 * 旋转立方体系统：spawn 实体，由 EntityHost 驱动 update / dispose。
 *
 * 本身是 DI 单例；实体是普通 class，不进入容器。
 * 相机位姿由根 Module 的 THREE_VIEWPORT 配置，不在此处理。
 */

import {
  Inject,
  Injectable,
  type EntitySystem,
} from '@threxus/core';
import { EntityHost, SceneSystem } from '@threxus/three';
import { RotatingCube, type RotatingOptions } from './rotating.entity';

export type { RotatingOptions };

@Injectable()
export class RotatingSystem
  extends EntityHost<RotatingCube>
  implements EntitySystem
{
  @Inject(SceneSystem)
  scenes: SceneSystem;

  protected attach(cube: RotatingCube): void {
    this.scenes.active.add(cube.mesh);
  }

  protected detach(cube: RotatingCube): void {
    this.scenes.active.remove(cube.mesh);
  }

  /**
   * 按属性创建实体并加入场景。
   */
  spawnCube(options: RotatingOptions = {}): RotatingCube {
    return this.spawn(new RotatingCube(options));
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
