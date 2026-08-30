/**
 * CSS2D 标签 Feature：DOM 文字叠加，适合工业孪生设备标注。
 */

import type { Camera, Object3D, Vector3Like } from 'three';
import { Vector3 } from 'three';
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
  readonly size: number;
}

export const LabelsService = createServiceKey<LabelsService>('labels');

export interface LabelsFeatureOptions {
  /** 标签 DOM 容器；默认在 canvas 父节点上创建全尺寸层。 */
  readonly container?: HTMLElement;
  /** CSS2DRenderer.domElement 的 className。 */
  readonly className?: string;
  /** 是否在 overlay stage 渲染，默认 true。 */
  readonly renderInOverlay?: boolean;
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

      const entries = new Map<
        string,
        {
          object: CSS2DObject;
          freeAnchor: boolean;
          world: Vector3;
          offset: Vector3;
          positionAnchor?: Vector3Like;
        }
      >();

      let visible = true;

      const syncSize = (size: RenderSize): void => {
        labelRenderer.setSize(size.width, size.height);
      };
      syncSize({
        width: context.canvas.clientWidth || 1,
        height: context.canvas.clientHeight || 1,
        pixelRatio: 1,
      });

      const service: LabelsService = {
        add(label) {
          if (entries.has(label.id)) {
            throw new Error(`Label id "${label.id}" is already registered.`);
          }
          const object = new CSS2DObject(label.element);
          object.visible = visible;
          const offset = new Vector3(
            ...(label.offset ?? ([0, 0, 0] as const)),
          );

          if (isObject3D(label.anchor)) {
            object.position.copy(offset);
            label.anchor.add(object);
            entries.set(label.id, {
              object,
              freeAnchor: false,
              world: new Vector3(),
              offset,
            });
          } else {
            context.scene.add(object);
            entries.set(label.id, {
              object,
              freeAnchor: true,
              world: new Vector3(),
              offset,
              positionAnchor: label.anchor,
            });
          }

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
        get size() {
          return entries.size;
        },
      };

      context.provide(LabelsService, service);

      context.onUpdate(() => {
        for (const entry of entries.values()) {
          if (!entry.freeAnchor || !entry.positionAnchor) {
            continue;
          }
          entry.object.position
            .set(
              entry.positionAnchor.x,
              entry.positionAnchor.y,
              entry.positionAnchor.z,
            )
            .add(entry.offset);
        }
      });

      const renderLabels = (camera: Camera): void => {
        if (!visible) {
          return;
        }
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
