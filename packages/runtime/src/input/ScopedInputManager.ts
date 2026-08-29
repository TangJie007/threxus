/**
 * Feature 作用域输入：注册自动绑定 Scope，dispose 时解绑。
 */

import type { Object3D } from 'three';
import type { FeatureScope } from '../feature/FeatureScope';
import type { Disposable } from '../lifecycle/Disposable';
import type { InputManager } from './InputManager';
import type {
  ThreePointerEventType,
  ThreePointerHandler,
} from './ThreePointerEvent';

export interface ScopedInputManager {
  /**
   * 在对象上注册 3D Pointer 监听器。
   * 返回的 Disposable 可提前解绑；Feature dispose 时也会自动解绑。
   */
  on(
    object: Object3D,
    type: ThreePointerEventType,
    handler: ThreePointerHandler,
  ): Disposable;
}

export function createScopedInputManager(
  manager: InputManager,
  scope: FeatureScope,
): ScopedInputManager {
  const scopeId = scope.feature.name;

  return {
    on(object, type, handler): Disposable {
      const disposable = manager.on(object, type, handler, scopeId);
      scope.addCleanup(disposable);
      return disposable;
    },
  };
}
