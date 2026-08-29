/**
 * Selection Feature：点击选中（依赖 Input），通过 SelectionService 暴露状态。
 */

import type { Object3D } from 'three';
import { remove } from 'es-toolkit';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import type { Disposable } from '../../lifecycle/Disposable';
import {
  SelectionService,
  type SelectionChangeListener,
  type SelectionService as SelectionServiceType,
} from './SelectionService';

export interface SelectionFeatureOptions {
  /** 参与点选的根对象；默认使用 scene。 */
  readonly roots?: readonly Object3D[];
  readonly multiSelect?: boolean;
}

export function selectionFeature(
  options: SelectionFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'selection',
    provides: [SelectionService],
    setup(context) {
      const selected: Object3D[] = [];
      const listeners = new Set<SelectionChangeListener>();
      const multiSelect = options.multiSelect ?? false;

      const notify = (): void => {
        const snapshot = [...selected];
        for (const listener of listeners) {
          listener(snapshot);
        }
      };

      const service: SelectionServiceType = {
        get selected() {
          return selected;
        },
        select(object, selectOptions) {
          const additive = selectOptions?.additive ?? false;
          if (!additive && !multiSelect) {
            selected.length = 0;
          }
          if (!selected.includes(object)) {
            selected.push(object);
            notify();
          }
        },
        deselect(object) {
          const before = selected.length;
          remove(selected, (item) => item === object);
          if (selected.length !== before) {
            notify();
          }
        },
        clear() {
          if (selected.length === 0) {
            return;
          }
          selected.length = 0;
          notify();
        },
        isSelected(object) {
          return selected.includes(object);
        },
        onChange(listener): Disposable {
          listeners.add(listener);
          return {
            dispose: () => {
              listeners.delete(listener);
            },
          };
        },
      };

      context.provide(SelectionService, service);

      const roots = options.roots ?? [context.scene];
      for (const root of roots) {
        context.input.on(root, 'click', (event) => {
          const additive = multiSelect && (event.nativeEvent as PointerEvent).shiftKey;
          if (additive) {
            if (service.isSelected(event.object)) {
              service.deselect(event.object);
            } else {
              service.select(event.object, { additive: true });
            }
          } else {
            service.clear();
            service.select(event.object);
          }
        });
      }
    },
  };
}
