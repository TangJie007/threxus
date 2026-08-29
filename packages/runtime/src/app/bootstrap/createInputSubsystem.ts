/**
 * 创建 InputManager，绑定 canvas 与当前 camera getter。
 */

import type { Camera } from 'three';
import { createInputManager, type InputManager } from '../../input';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';

export function createInputSubsystem(
  options: ThreeAppOptions,
  getCamera: () => Camera,
): InputManager {
  const inputOptions = options.input;

  return createInputManager({
    canvas: options.canvas,
    getCamera,
    ...(inputOptions?.clickMoveTolerance !== undefined
      ? { clickMoveTolerance: inputOptions.clickMoveTolerance }
      : {}),
    ...(inputOptions?.clickDuration !== undefined
      ? { clickDuration: inputOptions.clickDuration }
      : {}),
    ...(inputOptions?.allIntersections !== undefined
      ? { allIntersections: inputOptions.allIntersections }
      : {}),
    ...(inputOptions?.touchAction !== undefined
      ? { touchAction: inputOptions.touchAction }
      : {}),
    ...(inputOptions?.onComplexTransformWarning !== undefined
      ? {
          onComplexTransformWarning: inputOptions.onComplexTransformWarning,
        }
      : {}),
  });
}
