/**
 * 销毁服务：统一回收 Object3D 的 GPU 资源。
 *
 * 实体不进 DI；销毁经本服务，不手写散落的 dispose。
 */

import { Injectable } from '@threxus/core';
import type { Object3D } from 'three';
import { disposeObject3D } from '../utils/dispose-object3d';

@Injectable()
export class DisposeService {
  /**
   * 释放 geometry / material。
   *
   * @param object - 目标 Object3D
   * @param options.recursive - 是否遍历子树，默认 true
   * @param options.detach - 是否先从父节点卸下，默认 false
   */
  dispose(
    object: Object3D,
    options: { recursive?: boolean; detach?: boolean } = {},
  ): void {
    const recursive = options.recursive ?? true;
    if (options.detach) {
      object.parent?.remove(object);
    }
    disposeObject3D(object, recursive);
  }
}
