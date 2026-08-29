/**
 * 每个 pointerId 的运行时状态：按下锚点、捕获目标、当前 Hover 路径。
 */

import type { Object3D } from 'three';

export interface PointerDownAnchor {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp: number;
  /** 按下时的命中对象；未命中则为 null。 */
  readonly hitObject: Object3D | null;
  /** 按下时冒泡路径上的注册节点（从命中侧到根）。 */
  readonly path: readonly Object3D[];
}

export interface PointerRuntimeState {
  hoverPath: Object3D[];
  captureTarget: Object3D | null;
  down: PointerDownAnchor | null;
}

/** 创建空的 per-pointer 状态。 */
export function createPointerRuntimeState(): PointerRuntimeState {
  return {
    hoverPath: [],
    captureTarget: null,
    down: null,
  };
}
