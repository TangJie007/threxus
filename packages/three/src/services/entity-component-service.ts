/**
 * 实体组件调度中心（DI 服务）：挂载 / 移除 / 每帧 update。
 *
 * 组件本身不进 DI；仅本服务为单例管理者。
 */

import { Injectable, type OnUpdate } from '@threxus/core';
import type { Object3D } from 'three';
import {
  getComponentMap,
  type Component,
} from '../component';

@Injectable()
export class EntityComponentService implements OnUpdate {
  /** 至少挂过一个组件、需要每帧扫描的对象 */
  private readonly tracked = new Set<Object3D>();

  /**
   * 挂载组件；同 type 已存在则先 detach 再替换。
   */
  add<T extends Component>(object: Object3D, component: T): T {
    const map = getComponentMap(object);
    const prev = map.get(component.type);
    if (prev) {
      prev.onDetach?.(object);
    }
    map.set(component.type, component);
    component.onAttach?.(object);
    this.tracked.add(object);
    return component;
  }

  /**
   * 按 type 移除组件。
   */
  remove(object: Object3D, type: string): boolean {
    const map = getComponentMap(object);
    const component = map.get(type);
    if (!component) {
      return false;
    }
    map.delete(type);
    component.onDetach?.(object);
    if (map.size === 0) {
      this.tracked.delete(object);
    }
    return true;
  }

  /**
   * 按 type 取组件。
   */
  get<T extends Component>(object: Object3D, type: string): T | undefined {
    return getComponentMap(object).get(type) as T | undefined;
  }

  /**
   * 是否已挂载某 type。
   */
  has(object: Object3D, type: string): boolean {
    return getComponentMap(object).has(type);
  }

  /**
   * 移除对象上全部组件并停止跟踪。
   */
  clear(object: Object3D): void {
    const map = getComponentMap(object);
    for (const component of map.values()) {
      component.onDetach?.(object);
    }
    map.clear();
    this.tracked.delete(object);
  }

  onUpdate(dt: number): void {
    for (const object of this.tracked) {
      const map = getComponentMap(object);
      for (const component of map.values()) {
        component.update?.(dt, object);
      }
    }
  }
}
