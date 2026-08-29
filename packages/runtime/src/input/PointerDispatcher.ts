/**
 * Pointer 分发：Raycast → 冒泡路径 → enter/leave/move → click 判定。
 */

import { difference } from 'es-toolkit';
import {
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Intersection,
  type Object3D,
} from 'three';
import type { InteractiveObjectRegistry } from './InteractiveObjectRegistry';
import {
  createPointerRuntimeState,
  type PointerDownAnchor,
  type PointerRuntimeState,
} from './PointerState';
import {
  createThreePointerEvent,
  type ThreePointerEventType,
} from './ThreePointerEvent';

export interface PointerDispatcherOptions {
  readonly registry: InteractiveObjectRegistry;
  readonly getCamera: () => Camera;
  readonly clickMoveTolerance: number;
  readonly clickDuration: number;
  readonly allIntersections: boolean;
  readonly setDomPointerCapture: (pointerId: number) => void;
  readonly releaseDomPointerCapture: (pointerId: number) => void;
}

interface HitResolution {
  readonly intersections: Intersection[];
  readonly hitObject: Object3D | null;
  readonly path: Object3D[];
  readonly primary: Intersection | null;
}

export class PointerDispatcher {
  readonly #registry: InteractiveObjectRegistry;
  readonly #getCamera: () => Camera;
  readonly #clickMoveTolerance: number;
  readonly #clickDuration: number;
  readonly #allIntersections: boolean;
  readonly #setDomPointerCapture: (pointerId: number) => void;
  readonly #releaseDomPointerCapture: (pointerId: number) => void;
  readonly #raycaster = new Raycaster();
  readonly #ndc = new Vector2();
  readonly #pointers = new Map<number, PointerRuntimeState>();

  constructor(options: PointerDispatcherOptions) {
    this.#registry = options.registry;
    this.#getCamera = options.getCamera;
    this.#clickMoveTolerance = options.clickMoveTolerance;
    this.#clickDuration = options.clickDuration;
    this.#allIntersections = options.allIntersections;
    this.#setDomPointerCapture = options.setDomPointerCapture;
    this.#releaseDomPointerCapture = options.releaseDomPointerCapture;
  }

  getPointerState(pointerId: number): PointerRuntimeState {
    let state = this.#pointers.get(pointerId);
    if (!state) {
      state = createPointerRuntimeState();
      this.#pointers.set(pointerId, state);
    }
    return state;
  }

  handlePointerDown(
    nativeEvent: PointerEvent,
    ndcX: number,
    ndcY: number,
  ): void {
    const pointerId = nativeEvent.pointerId;
    const state = this.getPointerState(pointerId);
    const hit = this.#resolveHit(ndcX, ndcY, state.captureTarget);

    state.down = {
      pointerId,
      clientX: nativeEvent.clientX,
      clientY: nativeEvent.clientY,
      timeStamp: nativeEvent.timeStamp,
      hitObject: hit.hitObject,
      path: hit.path,
    };

    this.#updateHover(nativeEvent, hit, pointerId);
    this.#dispatchAlongPath(nativeEvent, 'pointerdown', hit, pointerId);
  }

  handlePointerMove(
    nativeEvent: PointerEvent,
    ndcX: number,
    ndcY: number,
  ): void {
    const pointerId = nativeEvent.pointerId;
    const state = this.getPointerState(pointerId);
    const hit = this.#resolveHit(ndcX, ndcY, state.captureTarget);

    this.#updateHover(nativeEvent, hit, pointerId);

    if (state.captureTarget) {
      this.#dispatchToTarget(
        nativeEvent,
        'pointermove',
        hit,
        pointerId,
        state.captureTarget,
      );
      return;
    }

    this.#dispatchAlongPath(nativeEvent, 'pointermove', hit, pointerId);
  }

  handlePointerUp(
    nativeEvent: PointerEvent,
    ndcX: number,
    ndcY: number,
  ): void {
    const pointerId = nativeEvent.pointerId;
    const state = this.getPointerState(pointerId);
    const hit = this.#resolveHit(ndcX, ndcY, state.captureTarget);

    if (state.captureTarget) {
      this.#dispatchToTarget(
        nativeEvent,
        'pointerup',
        hit,
        pointerId,
        state.captureTarget,
      );
    } else {
      this.#dispatchAlongPath(nativeEvent, 'pointerup', hit, pointerId);
    }

    this.#maybeDispatchClick(nativeEvent, hit, state);
    this.#releaseCapture(pointerId, state);
    state.down = null;
  }

  handlePointerCancel(
    nativeEvent: PointerEvent,
    ndcX: number,
    ndcY: number,
  ): void {
    const pointerId = nativeEvent.pointerId;
    const state = this.getPointerState(pointerId);
    const hit = this.#resolveHit(ndcX, ndcY, state.captureTarget);

    if (state.captureTarget) {
      this.#dispatchToTarget(
        nativeEvent,
        'pointercancel',
        hit,
        pointerId,
        state.captureTarget,
      );
    } else {
      this.#dispatchAlongPath(nativeEvent, 'pointercancel', hit, pointerId);
    }

    this.#releaseCapture(pointerId, state);
    state.down = null;
    this.#clearHover(nativeEvent, pointerId);
  }

  handlePointerLeaveCanvas(nativeEvent: PointerEvent): void {
    const pointerId = nativeEvent.pointerId;
    const state = this.#pointers.get(pointerId);
    if (!state || state.captureTarget) {
      return;
    }
    this.#clearHover(nativeEvent, pointerId);
  }

  handleDblClick(
    nativeEvent: MouseEvent,
    ndcX: number,
    ndcY: number,
  ): void {
    const pointerId =
      'pointerId' in nativeEvent && typeof nativeEvent.pointerId === 'number'
        ? nativeEvent.pointerId
        : 1;
    const state = this.getPointerState(pointerId);
    const hit = this.#resolveHit(ndcX, ndcY, state.captureTarget);
    this.#dispatchAlongPath(nativeEvent, 'dblclick', hit, pointerId);
  }

  /** 对象注销时清除所有 pointer 的 hover / capture / down 引用。 */
  clearObjectReferences(objects: readonly Object3D[]): void {
    if (objects.length === 0) {
      return;
    }
    const removed = new Set(objects);

    for (const [pointerId, state] of this.#pointers) {
      if (state.captureTarget && removed.has(state.captureTarget)) {
        this.#releaseCapture(pointerId, state);
      }

      if (state.down) {
        state.down = {
          ...state.down,
          hitObject:
            state.down.hitObject && removed.has(state.down.hitObject)
              ? null
              : state.down.hitObject,
          path: state.down.path.filter((node) => !removed.has(node)),
        };
      }

      if (state.hoverPath.some((node) => removed.has(node))) {
        state.hoverPath = state.hoverPath.filter((node) => !removed.has(node));
      }
    }
  }

  dispose(): void {
    for (const [pointerId, state] of this.#pointers) {
      if (state.captureTarget) {
        this.#releaseCapture(pointerId, state);
      }
    }
    this.#pointers.clear();
  }

  #resolveHit(
    ndcX: number,
    ndcY: number,
    captureTarget: Object3D | null,
  ): HitResolution {
    const roots = this.#registry.roots;
    let intersections: Intersection[] = [];

    if (roots.length > 0) {
      this.#ndc.set(ndcX, ndcY);
      this.#raycaster.setFromCamera(this.#ndc, this.#getCamera());
      intersections = this.#raycaster.intersectObjects([...roots], true);
    }

    if (captureTarget) {
      const primary =
        intersections.find(
          (item) =>
            item.object === captureTarget ||
            isAncestor(captureTarget, item.object),
        ) ?? createSyntheticIntersection(captureTarget);

      return {
        intersections,
        hitObject: captureTarget,
        path: this.#registry.buildRegisteredPath(captureTarget),
        primary,
      };
    }

    const primary = intersections[0] ?? null;
    const hitObject = primary?.object ?? null;
    const path = hitObject
      ? this.#registry.buildRegisteredPath(hitObject)
      : [];

    return { intersections, hitObject, path, primary };
  }

  #updateHover(
    nativeEvent: PointerEvent | MouseEvent,
    hit: HitResolution,
    pointerId: number,
  ): void {
    const state = this.getPointerState(pointerId);
    if (state.captureTarget) {
      return;
    }

    const previous = state.hoverPath;
    const next = hit.path;
    const leaving = difference(previous, next);
    const entering = difference(next, previous);

    for (const target of leaving) {
      this.#dispatchToTarget(
        nativeEvent,
        'pointerleave',
        hit,
        pointerId,
        target,
      );
    }

    // enter：由外到内（路径末尾更靠近根 → reverse 后先根后叶）
    for (const target of [...entering].reverse()) {
      this.#dispatchToTarget(
        nativeEvent,
        'pointerenter',
        hit,
        pointerId,
        target,
      );
    }

    state.hoverPath = [...next];
  }

  #clearHover(
    nativeEvent: PointerEvent | MouseEvent,
    pointerId: number,
  ): void {
    const state = this.getPointerState(pointerId);
    const previous = state.hoverPath;
    if (previous.length === 0) {
      return;
    }

    const emptyHit: HitResolution = {
      intersections: [],
      hitObject: null,
      path: [],
      primary: null,
    };

    for (const target of previous) {
      this.#dispatchToTarget(
        nativeEvent,
        'pointerleave',
        emptyHit,
        pointerId,
        target,
      );
    }
    state.hoverPath = [];
  }

  #dispatchAlongPath(
    nativeEvent: PointerEvent | MouseEvent,
    type: ThreePointerEventType,
    hit: HitResolution,
    pointerId: number,
  ): void {
    if (!hit.primary || hit.path.length === 0) {
      return;
    }

    if (this.#allIntersections && hit.intersections.length > 1) {
      const seen = new Set<Object3D>();
      for (const intersection of hit.intersections) {
        const path = this.#registry.buildRegisteredPath(intersection.object);
        for (const target of path) {
          if (seen.has(target)) {
            continue;
          }
          seen.add(target);
          const stopped = this.#dispatchToTarget(
            nativeEvent,
            type,
            {
              ...hit,
              primary: intersection,
              hitObject: intersection.object,
              path,
            },
            pointerId,
            target,
          );
          if (stopped) {
            return;
          }
        }
      }
      return;
    }

    for (const target of hit.path) {
      const stopped = this.#dispatchToTarget(
        nativeEvent,
        type,
        hit,
        pointerId,
        target,
      );
      if (stopped) {
        return;
      }
    }
  }

  #dispatchToTarget(
    nativeEvent: PointerEvent | MouseEvent,
    type: ThreePointerEventType,
    hit: HitResolution,
    pointerId: number,
    currentTarget: Object3D,
  ): boolean {
    const handlers = this.#registry.getHandlers(currentTarget, type);
    if (handlers.length === 0) {
      return false;
    }

    const primary =
      hit.primary ?? createSyntheticIntersection(currentTarget);
    const object = hit.hitObject ?? primary.object;

    let stopped = false;
    const event = createThreePointerEvent({
      type,
      nativeEvent,
      object,
      currentTarget,
      intersection: primary,
      intersections: hit.intersections,
      pointerId,
      onStopPropagation: () => {
        stopped = true;
      },
      onSetPointerCapture: () => {
        this.#setCapture(pointerId, currentTarget);
      },
      onReleasePointerCapture: () => {
        const state = this.getPointerState(pointerId);
        if (state.captureTarget === currentTarget) {
          this.#releaseCapture(pointerId, state);
        }
      },
    });

    for (const record of handlers) {
      record.handler(event);
      if (stopped) {
        break;
      }
    }

    return stopped;
  }

  #maybeDispatchClick(
    nativeEvent: PointerEvent,
    hit: HitResolution,
    state: PointerRuntimeState,
  ): void {
    const down = state.down;
    if (!down || !hit.primary) {
      return;
    }

    const dx = nativeEvent.clientX - down.clientX;
    const dy = nativeEvent.clientY - down.clientY;
    const distance = Math.hypot(dx, dy);
    const duration = nativeEvent.timeStamp - down.timeStamp;

    if (distance > this.#clickMoveTolerance || duration > this.#clickDuration) {
      return;
    }

    if (!isClickCompatible(down, hit, state.captureTarget)) {
      return;
    }

    if (state.captureTarget) {
      this.#dispatchToTarget(
        nativeEvent,
        'click',
        hit,
        nativeEvent.pointerId,
        state.captureTarget,
      );
      return;
    }

    this.#dispatchAlongPath(nativeEvent, 'click', hit, nativeEvent.pointerId);
  }

  #setCapture(pointerId: number, target: Object3D): void {
    const state = this.getPointerState(pointerId);
    state.captureTarget = target;
    this.#setDomPointerCapture(pointerId);
  }

  #releaseCapture(pointerId: number, state: PointerRuntimeState): void {
    if (!state.captureTarget) {
      return;
    }
    state.captureTarget = null;
    this.#releaseDomPointerCapture(pointerId);
  }
}

function isAncestor(ancestor: Object3D, node: Object3D): boolean {
  let current: Object3D | null = node.parent;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isClickCompatible(
  down: PointerDownAnchor,
  hit: HitResolution,
  captureTarget: Object3D | null,
): boolean {
  if (captureTarget) {
    return true;
  }
  if (!down.hitObject || !hit.hitObject) {
    return false;
  }
  if (down.hitObject === hit.hitObject) {
    return true;
  }
  if (isAncestor(down.hitObject, hit.hitObject)) {
    return true;
  }
  if (isAncestor(hit.hitObject, down.hitObject)) {
    return true;
  }
  return down.path.some((node) => hit.path.includes(node));
}

function createSyntheticIntersection(object: Object3D): Intersection {
  return {
    distance: 0,
    point: object.getWorldPosition(new Vector3()),
    object,
  };
}
