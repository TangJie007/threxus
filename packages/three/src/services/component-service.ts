/**
 * 组件调度中心（DI 服务）：挂载 / 移除 / 每帧 update。
 *
 * 组件本身不进 DI；仅本服务为单例管理者。
 * 热路径只遍历带 `update` 的组件，无 update 的挂载开销仅为登记。
 */

import { Injectable, type OnUpdate } from '@threxus/core';
import type { Object3D } from 'three';
import {
  getComponentMap,
  type Component,
  type ComponentType,
} from '../component';

type UpdateEntry = {
  object: Object3D;
  component: Component;
};

@Injectable()
export class ComponentService implements OnUpdate {
  /** 至少挂过一个组件的对象 */
  private readonly tracked = new Set<Object3D>();
  /** 仅含实现了 update 的挂载项（帧循环只扫这里） */
  private readonly updateEntries: UpdateEntry[] = [];

  /**
   * 挂载组件；同 type 已存在则先 detach 再替换。
   */
  add<T extends Component>(object: Object3D, component: T): T {
    const map = getComponentMap(object);
    const prev = map.get(component.type);
    if (prev) {
      prev.onDetach?.(object);
      this.removeUpdateEntry(object, prev);
    }
    map.set(component.type, component);
    component.onAttach?.(object);
    this.tracked.add(object);
    if (component.update) {
      this.updateEntries.push({ object, component });
    }
    return component;
  }

  /**
   * 按 type 移除组件。
   */
  remove(object: Object3D, type: ComponentType): boolean {
    const map = getComponentMap(object);
    const component = map.get(type);
    if (!component) {
      return false;
    }
    map.delete(type);
    component.onDetach?.(object);
    this.removeUpdateEntry(object, component);
    if (map.size === 0) {
      this.tracked.delete(object);
    }
    return true;
  }

  /**
   * 按 type 取组件。
   */
  get<T extends Component>(
    object: Object3D,
    type: ComponentType,
  ): T | undefined {
    return getComponentMap(object).get(type) as T | undefined;
  }

  /**
   * 是否已挂载某 type。
   */
  has(object: Object3D, type: ComponentType): boolean {
    return getComponentMap(object).has(type);
  }

  /**
   * 移除对象上全部组件并停止跟踪。
   */
  clear(object: Object3D): void {
    const map = getComponentMap(object);
    for (const component of map.values()) {
      component.onDetach?.(object);
      this.removeUpdateEntry(object, component);
    }
    map.clear();
    this.tracked.delete(object);
  }

  onUpdate(dt: number): void {
    const list = this.updateEntries;
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i]!;
      entry.component.update!(dt, entry.object);
    }
  }

  private removeUpdateEntry(object: Object3D, component: Component): void {
    const list = this.updateEntries;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const entry = list[i]!;
      if (entry.object === object && entry.component === component) {
        list.splice(i, 1);
        return;
      }
    }
  }
}
