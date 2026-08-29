/**
 * 销毁服务：业务侧回收 Object3D GPU 资源的**唯一入口**。
 *
 * 约定：Feature / 业务代码请注入本服务调用 `dispose`；
 * 底层工具 `disposeObject3D` 仅供本服务内部使用，业务勿直接调用。
 *
 * 对象本身不进 DI。
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
