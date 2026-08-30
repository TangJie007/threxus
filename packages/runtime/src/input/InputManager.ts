/**
 * App 级 InputManager：Canvas Pointer → NDC → Raycast → 分发。
 *
 * - 只监听 Canvas（Pointer Capture 期间依赖 DOM capture 收离开 Canvas 的事件）
 * - 默认不 preventDefault；touch-action 由配置决定
 * - Feature 通过 {@link createScopedInputManager} 获得有作用域的 `on`
 */

import type { Camera, Object3D } from 'three';
import { clamp } from 'es-toolkit';
import type { Disposable } from '../lifecycle/Disposable';
import { InteractiveObjectRegistry } from './InteractiveObjectRegistry';
import type { InputListenerRecord } from './InteractiveObjectRegistry';
import { PointerDispatcher } from './PointerDispatcher';
import {
  createScopedInputManager,
  type ScopedInputManager,
} from './ScopedInputManager';
import type { FeatureScope } from '../feature/FeatureScope';
import type {
  ThreePointerEventType,
  ThreePointerHandler,
} from './ThreePointerEvent';

export interface InputManagerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly getCamera: () => Camera;
  /** 单击允许的最大移动距离（CSS px），默认 4。拖拽超过此值不触发 click。 */
  readonly clickMoveTolerance?: number;
  /** 单击允许的最大按下时长（ms），默认 500。 */
  readonly clickDuration?: number;
  /**
   * 为 true 时按距离对所有交点做穿透分发；默认只向最近命中冒泡。
   */
  readonly allIntersections?: boolean;
  /** 开始 drag 的移动阈值（CSS px）；默认等于 clickMoveTolerance。 */
  readonly dragMoveTolerance?: number;
  /**
   * Raycaster.layers.mask；用于排除地面/辅助体等。
   * 例如仅拾取 layer 1：`1 << 1`。
   */
  readonly layersMask?: number;
  /**
   * 命中 Mesh 后向上查找 `userData[pickIdKey]` 作为逻辑目标。
   * 默认 `'pickId'`；传 `false` 关闭。
   */
  readonly pickIdKey?: string | false;
  /** pointermove 射线检测节流（ms），默认 0。 */
  readonly pointerMoveThrottleMs?: number;
  /**
   * 设置 canvas.style.touchAction；传 `false` 表示不修改。
   * 默认 `'none'`，避免触摸滚动抢事件。
   */
  readonly touchAction?: string | false;
  /** 开发模式下检测复杂 CSS transform 时回调警告。 */
  readonly onComplexTransformWarning?: (message: string) => void;
}

export interface InputManagerSnapshot {
  readonly interactiveObjects: number;
  readonly listeners: number;
}

export interface InputManager extends Disposable {
  createScope(scope: FeatureScope): ScopedInputManager;
  on(
    object: Object3D,
    type: ThreePointerEventType,
    handler: ThreePointerHandler,
    scopeId: string,
  ): Disposable;
  inspect(): InputManagerSnapshot;
}

const DOM_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerleave',
  'dblclick',
] as const;

type DomEventName = (typeof DOM_EVENTS)[number];

export function createInputManager(
  options: InputManagerOptions,
): InputManager {
  return new InputManagerImpl(options);
}

class InputManagerImpl implements InputManager {
  readonly #canvas: HTMLCanvasElement;
  readonly #registry = new InteractiveObjectRegistry();
  readonly #dispatcher: PointerDispatcher;
  readonly #listeners = new Map<DomEventName, EventListener>();
  readonly #records = new Set<InputListenerRecord>();
  #disposed = false;
  #previousTouchAction: string | null = null;
  #onComplexTransformWarning: ((message: string) => void) | null = null;

  constructor(options: InputManagerOptions) {
    this.#canvas = options.canvas;
    this.#onComplexTransformWarning =
      options.onComplexTransformWarning ?? null;

    this.#dispatcher = new PointerDispatcher({
      registry: this.#registry,
      getCamera: options.getCamera,
      clickMoveTolerance: options.clickMoveTolerance ?? 4,
      clickDuration: options.clickDuration ?? 500,
      allIntersections: options.allIntersections ?? false,
      ...(options.dragMoveTolerance !== undefined
        ? { dragMoveTolerance: options.dragMoveTolerance }
        : {}),
      ...(options.layersMask !== undefined
        ? { layersMask: options.layersMask }
        : {}),
      ...(options.pickIdKey !== undefined
        ? { pickIdKey: options.pickIdKey }
        : {}),
      ...(options.pointerMoveThrottleMs !== undefined
        ? { pointerMoveThrottleMs: options.pointerMoveThrottleMs }
        : {}),
      setDomPointerCapture: (pointerId) => {
        try {
          this.#canvas.setPointerCapture(pointerId);
        } catch {
          // 未处于活动 pointer 序列时 DOM 可能抛错，忽略。
        }
      },
      releaseDomPointerCapture: (pointerId) => {
        try {
          if (this.#canvas.hasPointerCapture?.(pointerId)) {
            this.#canvas.releasePointerCapture(pointerId);
          }
        } catch {
          // ignore
        }
      },
    });

    if (options.touchAction !== false) {
      this.#previousTouchAction = this.#canvas.style.touchAction;
      this.#canvas.style.touchAction = options.touchAction ?? 'none';
    }

    this.#bindDom();
  }

  createScope(scope: FeatureScope): ScopedInputManager {
    this.#assertAlive();
    return createScopedInputManager(this, scope);
  }

  on(
    object: Object3D,
    type: ThreePointerEventType,
    handler: ThreePointerHandler,
    scopeId: string,
  ): Disposable {
    this.#assertAlive();

    const record: InputListenerRecord = {
      object,
      type,
      handler,
      scopeId,
    };
    this.#registry.add(record);
    this.#records.add(record);

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        if (this.#registry.remove(record)) {
          this.#records.delete(record);
          if (!this.#registry.hasListeners(object)) {
            this.#dispatcher.clearObjectReferences([object]);
          }
        }
      },
    };
  }

  inspect(): InputManagerSnapshot {
    return {
      interactiveObjects: this.#registry.objectCount,
      listeners: this.#registry.getListenerCount(),
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.#unbindDom();
    this.#dispatcher.dispose();
    this.#registry.clear();
    this.#records.clear();

    if (this.#previousTouchAction !== null) {
      this.#canvas.style.touchAction = this.#previousTouchAction;
      this.#previousTouchAction = null;
    }
  }

  #bindDom(): void {
    for (const type of DOM_EVENTS) {
      const listener: EventListener = (event) => {
        this.#onDomEvent(type, event);
      };
      this.#listeners.set(type, listener);
      this.#canvas.addEventListener(type, listener);
    }
  }

  #unbindDom(): void {
    for (const type of DOM_EVENTS) {
      const listener = this.#listeners.get(type);
      if (listener) {
        this.#canvas.removeEventListener(type, listener);
      }
    }
    this.#listeners.clear();
  }

  #onDomEvent(type: DomEventName, event: Event): void {
    if (this.#disposed) {
      return;
    }

    const rect = this.#canvas.getBoundingClientRect();
    this.#warnIfComplexTransform(rect);

    if (type === 'dblclick') {
      const mouseEvent = event as MouseEvent;
      const ndc = clientToNdc(mouseEvent.clientX, mouseEvent.clientY, rect);
      this.#dispatcher.handleDblClick(mouseEvent, ndc.x, ndc.y);
      return;
    }

    const pointerEvent = event as PointerEvent;
    if (type === 'pointerleave') {
      this.#dispatcher.handlePointerLeaveCanvas(pointerEvent);
      return;
    }

    const ndc = clientToNdc(
      pointerEvent.clientX,
      pointerEvent.clientY,
      rect,
    );

    switch (type) {
      case 'pointerdown':
        this.#dispatcher.handlePointerDown(pointerEvent, ndc.x, ndc.y);
        break;
      case 'pointermove':
        this.#dispatcher.handlePointerMove(pointerEvent, ndc.x, ndc.y);
        break;
      case 'pointerup':
        this.#dispatcher.handlePointerUp(pointerEvent, ndc.x, ndc.y);
        break;
      case 'pointercancel':
        this.#dispatcher.handlePointerCancel(pointerEvent, ndc.x, ndc.y);
        break;
    }
  }

  #warnIfComplexTransform(rect: DOMRect): void {
    if (!this.#onComplexTransformWarning) {
      return;
    }
    if (typeof getComputedStyle !== 'function') {
      return;
    }

    const style = getComputedStyle(this.#canvas);
    const transform = style.transform;
    if (!transform || transform === 'none') {
      return;
    }

    // 2D 矩阵 a,b,c,d,e,f；仅允许均匀/轴对齐缩放 + 平移（b≈0,c≈0）
    const match = transform.match(/^matrix\((.+)\)$/);
    if (!match?.[1]) {
      this.#onComplexTransformWarning(
        'Canvas CSS transform is not a simple 2D matrix; pointer NDC may be incorrect.',
      );
      return;
    }

    const parts = match[1].split(',').map((part) => Number(part.trim()));
    const b = parts[1] ?? 0;
    const c = parts[2] ?? 0;
    if (Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6) {
      this.#onComplexTransformWarning(
        'Canvas has a rotated/skewed CSS transform; pointer picking may be incorrect.',
      );
    }

    void rect;
  }

  #assertAlive(): void {
    if (this.#disposed) {
      throw new Error('InputManager has been disposed.');
    }
  }
}

export interface NdcPoint {
  readonly x: number;
  readonly y: number;
}

/** Pointer 客户端坐标 → NDC（含页面滚动与普通 CSS 缩放）。 */
export function clientToNdc(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): NdcPoint {
  const width = Math.max(rect.width, Number.EPSILON);
  const height = Math.max(rect.height, Number.EPSILON);
  const x = clamp(((clientX - rect.left) / width) * 2 - 1, -1, 1);
  const y = clamp(-((clientY - rect.top) / height) * 2 + 1, -1, 1);
  return { x, y };
}
