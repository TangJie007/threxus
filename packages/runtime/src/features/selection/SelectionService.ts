/**
 * 选择服务：单选 / 多选状态与变更通知。
 */

import type { Object3D } from 'three';
import { createServiceKey } from '../../services/ServiceKey';
import type { Disposable } from '../../lifecycle/Disposable';

export type SelectionChangeListener = (
  selected: readonly Object3D[],
) => void;

export interface SelectionService {
  readonly selected: readonly Object3D[];
  select(object: Object3D, options?: { additive?: boolean }): void;
  deselect(object: Object3D): void;
  clear(): void;
  isSelected(object: Object3D): boolean;
  onChange(listener: SelectionChangeListener): Disposable;
}

export const SelectionService =
  createServiceKey<SelectionService>('selection');
