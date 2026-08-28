/**
 * 实体宿主基类：统一管理一类普通 Entity 的登记与销毁。
 *
 * Entity 本身不进 DI；子类实现 attach / detach（通常委托 SceneService）。
 * 每帧行为由 EntityComponentService 调度组件，不在此驱动。
 *
 * `T` 可为 Mesh、自定义实体壳，或任意对象。
 */

import type { OnDispose } from '@threxus/core';

type Disposable = { dispose(): void };

function tryDispose(entity: object): void {
  if (
    'dispose' in entity &&
    typeof (entity as Disposable).dispose === 'function'
  ) {
    (entity as Disposable).dispose();
  }
}

/**
 * 业务 Feature 的集合样板：spawn → onDispose。
 *
 * 子类实现 {@link attach} / {@link detach}，并按需实现生命周期钩子。
 *
 * @typeParam T - 实体类型（Mesh / 自定义对象等）
 */
export abstract class EntityHost<T extends object> implements OnDispose {
  private readonly entities: T[] = [];

  /** 当前已登记实体（只读） */
  getEntities(): readonly T[] {
    return this.entities;
  }

  /**
   * 挂到场景图（或其它宿主），由子类实现。
   */
  protected abstract attach(entity: T): void;

  /**
   * 从场景图卸下，由子类实现。
   */
  protected abstract detach(entity: T): void;

  /**
   * 登记实体：先 attach，再加入内部列表。
   *
   * @param entity - 已构造好的普通 Entity 实例
   */
  spawn(entity: T): T {
    this.attach(entity);
    this.entities.push(entity);
    return entity;
  }

  /**
   * 移除单个实体：detach + 可选 dispose，并从列表删除。
   *
   * @param entity - 先前 spawn 的实例
   * @returns 是否找到并移除
   */
  despawn(entity: T): boolean {
    const index = this.entities.indexOf(entity);
    if (index < 0) {
      return false;
    }
    this.entities.splice(index, 1);
    this.detach(entity);
    tryDispose(entity);
    return true;
  }

  onDispose(): void {
    for (const entity of this.entities) {
      this.detach(entity);
      tryDispose(entity);
    }
    this.entities.length = 0;
  }
}
