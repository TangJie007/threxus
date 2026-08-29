/**
 * WebGL 图形上下文状态（与 AppState 正交）。
 */

export type GraphicsState =
  | 'available'
  | 'lost'
  | 'restoring'
  | 'unavailable';
