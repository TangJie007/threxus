/**
 * 旋转立方体 Feature：spawn 实体并挂组件；帧循环由 EntityComponentService 驱动。
 *
 * 本身是 DI 单例；实体是普通 class，不进入容器。
 */

import {
  Inject,
  Injectable,
  type FeatureLifecycle,
} from '@threxus/core';
import {
  EntityComponentService,
  EntityHost,
  SceneService,
} from '@threxus/three';
import { RotatingComponent } from './rotating.component';
import { RotatingCube, type RotatingOptions } from './rotating.entity';

export type { RotatingOptions };

@Injectable()
export class RotatingFeature
  extends EntityHost<RotatingCube>
  implements FeatureLifecycle
{
  @Inject(SceneService)
  scenes: SceneService;

  @Inject(EntityComponentService)
  components: EntityComponentService;

  protected attach(cube: RotatingCube): void {
    this.scenes.attach(cube.mesh);
    this.components.add(cube.mesh, new RotatingComponent(cube.speed));
  }

  protected detach(cube: RotatingCube): void {
    this.components.clear(cube.mesh);
    this.scenes.detach(cube.mesh);
  }

  /**
   * 按属性创建实体并加入场景。
   */
  spawnCube(options: RotatingOptions = {}): RotatingCube {
    return this.spawn(new RotatingCube(options));
  }

  /** 组件层已驱动旋转；不再调用 entity.update */
  override onUpdate(_dt: number): void {}

  onModuleInit(): void {
    this.spawnCube({ size: 1, position: [-1.2, 0, 0] });
    this.spawnCube({
      size: 1.6,
      position: [1.4, 0, 0],
      speed: { x: 0.5, y: 0.9 },
    });
  }
}

/**
 * @deprecated 使用 {@link RotatingFeature}
 */
export const RotatingSystem = RotatingFeature;
