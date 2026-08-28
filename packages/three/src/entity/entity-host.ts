/**
 * 实体宿主基类：统一管理一类普通 Entity 的登记与销毁。
 *
 * Entity 本身不进 DI；子类实现 attach / detach（通常委托 SceneService）。
 * 每帧行为优先由 EntityComponentService 调度组件；HostEntity.update 仅兼容保留。
 */

import type { OnDispose, OnUpdate } from '@threxus/core';

/**
 * Host 可驱动的最小 Entity 约定。
 *
 * `update` / `dispose` 均为可选；有则由 {@link EntityHost} 调用。
 * 新代码请把行为放在组件层，而非 Entity.update。
 */
export type HostEntity = {
  update?(dt: number): void;
  dispose?(): void;
};

/**
 * 业务 Feature 的集合样板：spawn →（可选）onUpdate → onDispose。
 *
 * 子类实现 {@link attach} / {@link detach}，并按需实现 `onModuleInit`。
 *
 * @typeParam T - 实体类型
 */
export abstract class EntityHost<T extends HostEntity>
  implements OnUpdate, OnDispose
{
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
   * 移除单个实体：detach + dispose，并从列表删除。
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
    entity.dispose?.();
    return true;
  }

  /**
   * 兼容路径：若实体仍实现 update 则调用。
   * 新代码应依赖 EntityComponentService，无需 Entity.update。
   */
  onUpdate(dt: number): void {
    const list = this.entities;
    for (let i = 0; i < list.length; i += 1) {
      list[i]!.update?.(dt);
    }
  }

  onDispose(): void {
    for (const entity of this.entities) {
      this.detach(entity);
      entity.dispose?.();
    }
    this.entities.length = 0;
  }
}
