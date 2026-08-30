/**
 * 拾取目标解析：从命中 Mesh 沿 parent 链查找带 pickId 的逻辑对象。
 */

import type { Object3D } from 'three';

export const DEFAULT_PICK_ID_KEY = 'pickId';

/** 与 `input.layersMask: 1 << DEFAULT_PICK_LAYER` 对齐的默认拾取层。 */
export const DEFAULT_PICK_LAYER = 1;

export type MarkPickableOptions = {
  /**
   * 为物体打开拾取 layer（`layers.enable`，保留第 0 层可见性）。
   * 配合 `createThreeApp({ input: { layersMask: 1 << layer } })` 使用。
   */
  readonly layer?: number;
  /**
   * 是否遍历子树一并 `enable(layer)`。
   * 默认 `true`（仅在指定了 `layer` 时生效）；`pickId` 始终只写在根对象上。
   */
  readonly deep?: boolean;
  /** `userData` 中存放 pickId 的键；默认 `pickId`。 */
  readonly pickIdKey?: string;
};

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

/**
 * 打开拾取 layer（`enable`，不 `set`，以免关掉默认第 0 层导致“能点但看不见”）。
 */
export function enablePickLayer(
  root: Object3D,
  layer: number = DEFAULT_PICK_LAYER,
  deep: boolean = true,
): Object3D {
  if (deep) {
    root.traverse((o) => o.layers.enable(layer));
  } else {
    root.layers.enable(layer);
  }
  return root;
}

/**
 * 标记对象为可拾取逻辑根（写入 `userData.pickId`）。
 *
 * 第三参可为旧版 `pickIdKey` 字符串，或 `{ layer, deep, pickIdKey }`：
 * - 仅写 id：`markPickable(mesh, 'box-1')`
 * - 同时进拾取层：`markPickable(root, 'cab-7', { layer: 1 })`
 */
export function markPickable(
  object: Object3D,
  pickId: string | number | true = true,
  optionsOrPickIdKey?: MarkPickableOptions | string,
): Object3D {
  const options: MarkPickableOptions =
    typeof optionsOrPickIdKey === 'string'
      ? { pickIdKey: optionsOrPickIdKey }
      : (optionsOrPickIdKey ?? {});

  const pickIdKey = options.pickIdKey ?? DEFAULT_PICK_ID_KEY;
  object.userData[pickIdKey] = pickId;

  if (options.layer !== undefined) {
    enablePickLayer(object, options.layer, options.deep ?? true);
  }

  return object;
}
