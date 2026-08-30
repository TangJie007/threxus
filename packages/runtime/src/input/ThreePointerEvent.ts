/**
 * 3D Pointer 事件类型与事件对象。
 *
 * 事件语义对齐设计契约：
 * - `object`：射线实际命中的可射线对象
 * - `currentTarget`：当前处理监听器的注册对象（冒泡时会变化）
 * - `stopPropagation`：阻止继续向父级已注册节点分发
 * - `setPointerCapture` / `releasePointerCapture`：按 pointerId 捕获
 */

import type { Intersection, Object3D, Vector2, Vector3 } from 'three';

/** 第一阶段支持的 Pointer 事件类型。 */
export type ThreePointerEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'pointerenter'
  | 'pointerleave'
  | 'click'
  | 'dblclick'
  | 'dragstart'
  | 'drag'
  | 'dragend';

export type ThreePointerHandler = (event: ThreePointerEvent) => void;

export interface ThreePointerEvent {
  readonly type: ThreePointerEventType;
  readonly nativeEvent: PointerEvent | MouseEvent;
  readonly object: Object3D;
  readonly currentTarget: Object3D;
  readonly intersection: Intersection;
  readonly intersections: readonly Intersection[];
  readonly point: Vector3;
  readonly uv?: Vector2;
  readonly pointerId: number;

  stopPropagation(): void;
  setPointerCapture(): void;
  releasePointerCapture(): void;
}

export interface CreateThreePointerEventOptions {
  readonly type: ThreePointerEventType;
  readonly nativeEvent: PointerEvent | MouseEvent;
  readonly object: Object3D;
  readonly currentTarget: Object3D;
  readonly intersection: Intersection;
  readonly intersections: readonly Intersection[];
  readonly pointerId: number;
  readonly onStopPropagation: () => void;
  readonly onSetPointerCapture: () => void;
  readonly onReleasePointerCapture: () => void;
}

/** 构造一次分发用的事件对象；uv 仅在 intersection 提供时存在。 */
export function createThreePointerEvent(
  options: CreateThreePointerEventOptions,
): ThreePointerEvent {
  const uv = options.intersection.uv ?? undefined;

  return {
    type: options.type,
    nativeEvent: options.nativeEvent,
    object: options.object,
    currentTarget: options.currentTarget,
    intersection: options.intersection,
    intersections: options.intersections,
    point: options.intersection.point,
    ...(uv !== undefined ? { uv } : {}),
    pointerId: options.pointerId,
    stopPropagation: options.onStopPropagation,
    setPointerCapture: options.onSetPointerCapture,
    releasePointerCapture: options.onReleasePointerCapture,
  };
}
