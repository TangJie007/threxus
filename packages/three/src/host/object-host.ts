/**
 * ObjectHost：Feature 用来批量登记 / 销毁原生对象的基类。
 *
 * DI 边界（易混，读这里）：
 * - 继承本类的 Feature（如 RotatingFeature）→ **进 DI**（@Injectable + providers）
 * - spawn 进去的 T（Mesh / Group 等）→ **不进 DI**，只是普通 Three 对象
 * - 挂在 Mesh 上的 Component → **不进 DI**，由 ComponentService 每帧调度
 *
 * 本类只负责 spawn / despawn / onDispose 列表；
 * 子类实现 attach / detach（通常委托 SceneService）；
 * 不要在这里写每帧逻辑。
 */

import type { OnDispose } from '@threxus/core';

type Disposable = { dispose(): void };

function tryDispose(object: object): void {
  if (
    'dispose' in object &&
    typeof (object as Disposable).dispose === 'function'
  ) {
    (object as Disposable).dispose();
  }
}

/**
 * Feature 继承本类即可管理一类对象：spawn → onDispose。
 *
 * @typeParam T - 被托管的原生对象类型（如 Mesh），不是 DI 服务
 */
export abstract class ObjectHost<T extends object> implements OnDispose {
  private readonly objects: T[] = [];

  /** 当前已登记对象（只读） */
  getObjects(): readonly T[] {
    return this.objects;
  }

  /** 挂到场景图；由子类实现（通常 `scenes.attach`） */
  protected abstract attach(object: T): void;

  /** 从场景图卸下；由子类实现（通常清组件 + `scenes.detach`） */
  protected abstract detach(object: T): void;

  /**
   * 登记对象：先 attach，再加入内部列表。
   *
   * @param object - 普通 Three 对象实例（不注册进 DI）
   */
  spawn(object: T): T {
    this.attach(object);
    this.objects.push(object);
    return object;
  }

  /**
   * 移除单个对象：detach + 若有 dispose 则调用，并从列表删除。
   *
   * @param object - 先前 spawn 的实例
   * @returns 是否找到并移除
   */
  despawn(object: T): boolean {
    const index = this.objects.indexOf(object);
    if (index < 0) {
      return false;
    }
    this.objects.splice(index, 1);
    this.detach(object);
    tryDispose(object);
    return true;
  }

  onDispose(): void {
    for (const object of this.objects) {
      this.detach(object);
      tryDispose(object);
    }
    this.objects.length = 0;
  }
}
