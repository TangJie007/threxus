/**
 * 输入模块公共导出。
 */

export {
  createInputManager,
  clientToNdc,
  type InputManager,
  type InputManagerOptions,
  type InputManagerSnapshot,
  type NdcPoint,
} from './InputManager';
export {
  createScopedInputManager,
  type ScopedInputManager,
} from './ScopedInputManager';
export {
  createThreePointerEvent,
  type CreateThreePointerEventOptions,
  type ThreePointerEvent,
  type ThreePointerEventType,
  type ThreePointerHandler,
} from './ThreePointerEvent';
export { InteractiveObjectRegistry } from './InteractiveObjectRegistry';
export type { InputListenerRecord } from './InteractiveObjectRegistry';
export { PointerDispatcher } from './PointerDispatcher';
export {
  createPointerRuntimeState,
  type PointerDownAnchor,
  type PointerRuntimeState,
} from './PointerState';
export {
  DEFAULT_PICK_ID_KEY,
  DEFAULT_PICK_LAYER,
  enablePickLayer,
  markPickable,
  resolvePickTarget,
  type MarkPickableOptions,
} from './pickTarget';
