/**
 * CSS2D 标签 Feature：DOM 文字叠加，支持距离剔除与遮挡淡出。
 */

import type { Camera, Object3D, Vector3Like } from 'three';
import { Raycaster, Vector3 } from 'three';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/addons/renderers/CSS2DRenderer.js';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import type { Disposable } from '../../lifecycle/Disposable';
import type { RenderSize } from '../../rendering/types';
import { createServiceKey } from '../../services/ServiceKey';

export interface LabelDescriptor {
  readonly id: string;
  readonly anchor: Object3D | Vector3Like;
  readonly element: HTMLElement;
  readonly offset?: readonly [number, number, number];
}

export interface LabelsService {
  add(label: LabelDescriptor): Disposable;
  remove(id: string): void;
  clear(): void;
  setVisible(visible: boolean): void;
  /** 批量新增；同 id 已存在则替换。 */
  setAll(labels: readonly LabelDescriptor[]): void;
  readonly size: number;
}

export const LabelsService = createServiceKey<LabelsService>('labels');

export interface LabelsFeatureOptions {
  readonly container?: HTMLElement;
  readonly className?: string;
  readonly renderInOverlay?: boolean;
  /** 超过该距离隐藏标签（世界单位），默认不限制。 */
  readonly maxDistance?: number;
  /**
   * 遮挡剔除：对标签锚点做射线检测；命中其它物体则淡出。
   * 传入遮挡根节点；默认关闭。
   */
  readonly occlusionRoots?: readonly Object3D[];
  /** 被遮挡时的 opacity，默认 0.15；传 0 则完全隐藏。 */
  readonly occludedOpacity?: number;
}

interface LabelEntry {
  object: CSS2DObject;
  freeAnchor: boolean;
  offset: Vector3;
  positionAnchor?: Vector3Like;
  element: HTMLElement;
  baseOpacity: string;
}

export function labelsFeature(
  options: LabelsFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'labels',
    provides: [LabelsService],
    setup(context) {
      const host =
        options.container ??
        createDefaultLabelHost(context.canvas, options.className);
      const ownedHost = options.container === undefined;
      if (ownedHost) {
        context.addCleanup(() => {
          host.remove();
        });
      }

      const labelRenderer = new CSS2DRenderer();
      labelRenderer.domElement.style.position = 'absolute';
      labelRenderer.domElement.style.inset = '0';
      labelRenderer.domElement.style.pointerEvents = 'none';
      if (options.className) {
        labelRenderer.domElement.className = options.className;
      }
      host.appendChild(labelRenderer.domElement);
      context.addCleanup(() => {
        labelRenderer.domElement.remove();
      });

      const entries = new Map<string, LabelEntry>();
      const raycaster = new Raycaster();
      const world = new Vector3();
      const camDir = new Vector3();
      let visible = true;
      const maxDistance = options.maxDistance;
      const occludedOpacity = options.occludedOpacity ?? 0.15;
      const occlusionRoots = options.occlusionRoots ?? [];

      const syncSize = (size: RenderSize): void => {
        labelRenderer.setSize(size.width, size.height);
      };
      syncSize({
        width: context.canvas.clientWidth || 1,
        height: context.canvas.clientHeight || 1,
        pixelRatio: 1,
      });

      const mountLabel = (label: LabelDescriptor): void => {
        const existing = entries.get(label.id);
        if (existing) {
          existing.object.removeFromParent();
          entries.delete(label.id);
        }

        const object = new CSS2DObject(label.element);
        object.visible = visible;
        const offset = new Vector3(
          ...(label.offset ?? ([0, 0, 0] as const)),
        );
        const baseOpacity = label.element.style.opacity || '1';

        if (isObject3D(label.anchor)) {
          object.position.copy(offset);
          label.anchor.add(object);
          entries.set(label.id, {
            object,
            freeAnchor: false,
            offset,
            element: label.element,
            baseOpacity,
          });
        } else {
          context.scene.add(object);
          entries.set(label.id, {
            object,
            freeAnchor: true,
            offset,
            positionAnchor: label.anchor,
            element: label.element,
            baseOpacity,
          });
        }
      };

      const service: LabelsService = {
        add(label) {
          mountLabel(label);
          return {
            dispose: () => {
              service.remove(label.id);
            },
          };
        },
        remove(id) {
          const entry = entries.get(id);
          if (!entry) {
            return;
          }
          entry.object.removeFromParent();
          entries.delete(id);
        },
        clear() {
          for (const id of [...entries.keys()]) {
            service.remove(id);
          }
        },
        setVisible(next) {
          visible = next;
          for (const entry of entries.values()) {
            entry.object.visible = next;
          }
        },
        setAll(labels) {
          const keep = new Set(labels.map((item) => item.id));
          for (const id of [...entries.keys()]) {
            if (!keep.has(id)) {
              service.remove(id);
            }
          }
          for (const label of labels) {
            mountLabel(label);
          }
        },
        get size() {
          return entries.size;
        },
      };

      context.provide(LabelsService, service);

      const resolveWorld = (entry: LabelEntry): Vector3 => {
        if (entry.freeAnchor && entry.positionAnchor) {
          world
            .set(
              entry.positionAnchor.x,
              entry.positionAnchor.y,
              entry.positionAnchor.z,
            )
            .add(entry.offset);
          entry.object.position.copy(world);
          return world;
        }
        entry.object.getWorldPosition(world);
        return world;
      };

      const updateVisibility = (camera: Camera): void => {
        if (!visible) {
          return;
        }
        camera.getWorldDirection(camDir);
        for (const entry of entries.values()) {
          const pos = resolveWorld(entry);
          let show = true;
          let opacity = entry.baseOpacity;

          if (maxDistance !== undefined) {
            if (camera.position.distanceTo(pos) > maxDistance) {
              show = false;
            }
          }

          if (show && occlusionRoots.length > 0) {
            const distance = camera.position.distanceTo(pos);
            raycaster.set(
              camera.position,
              tmpDirection(camera.position, pos, camDir),
            );
            raycaster.far = distance - 0.05;
            const hits = raycaster.intersectObjects([...occlusionRoots], true);
            const blocked = hits.some(
              (hit) =>
                hit.object !== entry.object &&
                !isAncestor(entry.object, hit.object) &&
                !isAncestor(hit.object, entry.object),
            );
            if (blocked) {
              if (occludedOpacity <= 0) {
                show = false;
              } else {
                opacity = String(occludedOpacity);
              }
            }
          }

          entry.object.visible = show;
          entry.element.style.opacity = show ? opacity : entry.baseOpacity;
        }
      };

      const renderLabels = (camera: Camera): void => {
        if (!visible) {
          return;
        }
        updateVisibility(camera);
        labelRenderer.render(context.scene, camera);
      };

      if (options.renderInOverlay !== false) {
        context.rendering.addStage({
          name: 'css2d-labels',
          stage: 'overlay',
          priority: 100,
          render(renderContext) {
            syncSize({
              width: context.canvas.clientWidth || 1,
              height: context.canvas.clientHeight || 1,
              pixelRatio: 1,
            });
            renderLabels(renderContext.camera);
          },
        });
      } else {
        context.onUpdate(() => {
          syncSize({
            width: context.canvas.clientWidth || 1,
            height: context.canvas.clientHeight || 1,
            pixelRatio: 1,
          });
          renderLabels(context.camera);
        });
      }

      context.addCleanup(() => {
        service.clear();
      });
    },
  };
}

const _dir = new Vector3();

function tmpDirection(
  from: Vector3,
  to: Vector3,
  _unused: Vector3,
): Vector3 {
  void _unused;
  return _dir.subVectors(to, from).normalize();
}

function createDefaultLabelHost(
  canvas: HTMLCanvasElement,
  className?: string,
): HTMLElement {
  const parent = canvas.parentElement ?? document.body;
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.overflow = 'hidden';
  if (className) {
    host.className = className;
  }
  if (typeof getComputedStyle === 'function') {
    const parentStyle = getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
  }
  parent.appendChild(host);
  return host;
}

function isObject3D(value: Object3D | Vector3Like): value is Object3D {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isObject3D' in value &&
    (value as Object3D).isObject3D === true
  );
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
