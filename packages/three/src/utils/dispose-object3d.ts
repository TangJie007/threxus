/**
 * 释放 Object3D 上的 GPU 资源（geometry / material）。
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
 * 默认递归 traverse；不从父节点 remove，也不 dispose 子树以外的共享资源引用计数。
 *
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
