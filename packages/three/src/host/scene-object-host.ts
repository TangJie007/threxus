/**
 * SceneObjectHost：面向场景 Mesh/Object3D 的 Feature 基类。
 *
 * 已注入 Scene / Component / Dispose，并实现默认 attach / detach：
 * - attach → scenes.attach
 * - detach → 清组件 + scenes.detach + DisposeService.dispose
 *
 * 子类一般只需 spawnXxx + onModuleInit；DI 字段来自本基类（core 会沿原型链收集 @Inject）。
 */

import { Inject } from '@threxus/core';
import type { Object3D } from 'three';
import { ComponentService } from '../services/component-service';
import { DisposeService } from '../services/dispose-service';
import { SceneService } from '../services/scene-service';
import { ObjectHost } from './object-host';

/**
 * @typeParam T - 场景对象类型，默认 Object3D（可为 Mesh）
 */
export abstract class SceneObjectHost<
  T extends Object3D = Object3D,
> extends ObjectHost<T> {
  @Inject(SceneService)
  scenes!: SceneService;

  @Inject(ComponentService)
  components!: ComponentService;

  @Inject(DisposeService)
  disposeService!: DisposeService;

  protected attach(object: T): void {
    this.scenes.attach(object);
  }

  protected detach(object: T): void {
    this.components.clear(object);
    this.scenes.detach(object);
    this.disposeService.dispose(object, { recursive: false });
  }
}
