/**
 * 可交互对象注册表。
 *
 * - 首次为对象注册任意事件时加入射线检测集合
 * - 最后一个监听器移除时退出射线集合
 * - Raycast 只遍历本表中的根对象，不扫整棵 Scene
 */

import { remove } from 'es-toolkit';
import type { Object3D } from 'three';
import type {
  ThreePointerEventType,
  ThreePointerHandler,
} from './ThreePointerEvent';

export interface InputListenerRecord {
  readonly object: Object3D;
  readonly type: ThreePointerEventType;
  readonly handler: ThreePointerHandler;
  readonly scopeId: string;
}

export class InteractiveObjectRegistry {
  readonly #byObject = new Map<
    Object3D,
    Map<ThreePointerEventType, Set<InputListenerRecord>>
  >();
  readonly #roots: Object3D[] = [];
  readonly #listenerCountByScope = new Map<string, number>();

  get roots(): readonly Object3D[] {
    return this.#roots;
  }

  get objectCount(): number {
    return this.#roots.length;
  }

  getListenerCount(scopeId?: string): number {
    if (scopeId === undefined) {
      let total = 0;
      for (const count of this.#listenerCountByScope.values()) {
        total += count;
      }
      return total;
    }
    return this.#listenerCountByScope.get(scopeId) ?? 0;
  }

  add(record: InputListenerRecord): void {
    let byType = this.#byObject.get(record.object);
    if (!byType) {
      byType = new Map();
      this.#byObject.set(record.object, byType);
      this.#roots.push(record.object);
    }

    let handlers = byType.get(record.type);
    if (!handlers) {
      handlers = new Set();
      byType.set(record.type, handlers);
    }

    handlers.add(record);
    this.#listenerCountByScope.set(
      record.scopeId,
      (this.#listenerCountByScope.get(record.scopeId) ?? 0) + 1,
    );
  }

  remove(record: InputListenerRecord): boolean {
    const byType = this.#byObject.get(record.object);
    if (!byType) {
      return false;
    }

    const handlers = byType.get(record.type);
    if (!handlers || !handlers.delete(record)) {
      return false;
    }

    const scopeCount = this.#listenerCountByScope.get(record.scopeId) ?? 0;
    if (scopeCount <= 1) {
      this.#listenerCountByScope.delete(record.scopeId);
    } else {
      this.#listenerCountByScope.set(record.scopeId, scopeCount - 1);
    }

    if (handlers.size === 0) {
      byType.delete(record.type);
    }

    if (byType.size === 0) {
      this.#byObject.delete(record.object);
      remove(this.#roots, (root) => root === record.object);
    }

    return true;
  }

  /** 移除某 Scope 下全部监听器；返回受影响对象（用于清 Hover）。 */
  removeByScope(scopeId: string): Object3D[] {
    const affected: Object3D[] = [];
    const snapshot: InputListenerRecord[] = [];

    for (const byType of this.#byObject.values()) {
      for (const handlers of byType.values()) {
        for (const record of handlers) {
          if (record.scopeId === scopeId) {
            snapshot.push(record);
          }
        }
      }
    }

    for (const record of snapshot) {
      if (this.remove(record) && !affected.includes(record.object)) {
        affected.push(record.object);
      }
    }

    return affected;
  }

  hasListeners(object: Object3D, type?: ThreePointerEventType): boolean {
    const byType = this.#byObject.get(object);
    if (!byType) {
      return false;
    }
    if (type === undefined) {
      return byType.size > 0;
    }
    const handlers = byType.get(type);
    return handlers !== undefined && handlers.size > 0;
  }

  getHandlers(
    object: Object3D,
    type: ThreePointerEventType,
  ): readonly InputListenerRecord[] {
    const handlers = this.#byObject.get(object)?.get(type);
    return handlers ? [...handlers] : [];
  }

  /**
   * 从命中对象沿 parent 向上收集「已注册任意监听」的节点。
   * 顺序：靠近命中 → 靠近根（冒泡方向）。
   */
  buildRegisteredPath(hitObject: Object3D): Object3D[] {
    const path: Object3D[] = [];
    let current: Object3D | null = hitObject;

    while (current) {
      if (this.#byObject.has(current)) {
        path.push(current);
      }
      current = current.parent;
    }

    return path;
  }

  clear(): void {
    this.#byObject.clear();
    this.#roots.length = 0;
    this.#listenerCountByScope.clear();
  }
}
