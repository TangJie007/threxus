/**
 * 轻量组件约定（L3）：普通 TS 类，不进 DI。
 *
 * 挂载在 Object3D.userData，由 {@link EntityComponentService} 调度。
 */

import type { Object3D } from 'three';

/** userData 上组件袋的键 */
export const COMPONENTS_USERDATA_KEY = 'threxusComponents';

/**
 * 组件最小接口。
 */
export interface Component {
  /** 组件类型键（同 object 上唯一） */
  readonly type: string;
  onAttach?(object: Object3D): void;
  onDetach?(object: Object3D): void;
  update?(dt: number, object: Object3D): void;
}

/** Object3D.userData 上的组件 Map */
export type ComponentMap = Map<string, Component>;

/**
 * 读取或创建对象上的组件袋。
 */
export function getComponentMap(object: Object3D): ComponentMap {
  const data = object.userData as Record<string, unknown>;
  let map = data[COMPONENTS_USERDATA_KEY] as ComponentMap | undefined;
  if (!map) {
    map = new Map();
    data[COMPONENTS_USERDATA_KEY] = map;
  }
  return map;
}
