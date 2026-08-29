/**
 * 释放 Object3D 上的 GPU 资源（geometry / material）。
 *
 * **内部工具**：业务请走 {@link DisposeService.dispose}，不要直接调用本函数。
 */

import { Line, Mesh, Points, type Material, type Object3D } from 'three';

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }
  material.dispose();
}

function disposeNode(node: Object3D): void {
  if (
    !(node instanceof Mesh || node instanceof Line || node instanceof Points)
  ) {
    return;
  }
  node.geometry.dispose();
  disposeMaterial(node.material);
}

/**
 * 释放对象上的 geometry / material。
 *
 * @internal 业务请使用 DisposeService
 * @param object - 目标 Object3D（通常是 Mesh 或 Group）
 * @param recursive - 是否遍历子节点，默认 `true`
 */
export function disposeObject3D(object: Object3D, recursive = true): void {
  if (recursive) {
    object.traverse(disposeNode);
    return;
  }
  disposeNode(object);
}
