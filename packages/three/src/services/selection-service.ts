/**
 * 选中服务：持有当前选中的 Object3D 引用（实体不进 DI）。
 */

import { Injectable } from '@threxus/core';
import type { Object3D } from 'three';

@Injectable()
export class SelectionService {
  private selected: Object3D[] = [];

  /** 当前选中列表（只读副本） */
  getAll(): readonly Object3D[] {
    return this.selected;
  }

  /** 首个选中对象 */
  get primary(): Object3D | undefined {
    return this.selected[0];
  }

  set(objects: Object3D[]): void {
    this.selected = [...objects];
  }

  add(object: Object3D): void {
    if (!this.selected.includes(object)) {
      this.selected.push(object);
    }
  }

  remove(object: Object3D): void {
    this.selected = this.selected.filter((o) => o !== object);
  }

  clear(): void {
    this.selected = [];
  }

  has(object: Object3D): boolean {
    return this.selected.includes(object);
  }
}
