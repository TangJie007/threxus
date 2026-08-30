/**
 * 拾取目标解析：从命中 Mesh 沿 parent 链查找带 pickId 的逻辑对象。
 */

import type { Object3D } from 'three';

export const DEFAULT_PICK_ID_KEY = 'pickId';

/**
 * 自 object 向上查找 `userData[pickIdKey]`；找到则返回该祖先，否则返回 object 本身。
 */
export function resolvePickTarget(
  object: Object3D,
  pickIdKey: string = DEFAULT_PICK_ID_KEY,
): Object3D {
  let current: Object3D | null = object;
  while (current) {
    const value = current.userData[pickIdKey];
    if (value !== undefined && value !== null && value !== false) {
      return current;
    }
    current = current.parent;
  }
  return object;
}

/** 标记对象为可拾取逻辑根（写入 userData.pickId）。 */
export function markPickable(
  object: Object3D,
  pickId: string | number | true = true,
  pickIdKey: string = DEFAULT_PICK_ID_KEY,
): Object3D {
  object.userData[pickIdKey] = pickId;
  return object;
}
