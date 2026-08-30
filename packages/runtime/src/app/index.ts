/**
 * @threxus/runtime App 模块入口。
 *
 * ```text
 * app/
 *   types/       AppState / ThreeApp / Options / Snapshot
 *   bootstrap/   Scheduler / Assets / Rendering / Input 创建
 *   context/     ThreeContext 装配与服务契约
 *   runtime/     状态机与 createThreeApp
 * ```
 */

export { createThreeApp } from './runtime/createThreeApp';
export type { AppState } from './types/AppState';
export type { ThreeApp } from './types/ThreeApp';
export type {
  FeatureSnapshot,
  ResourceLeakSnapshot,
  RuntimeCounts,
  RuntimeSnapshot,
  SetCameraOptions,
  ThreeAppOptions,
} from './types/ThreeAppOptions';
export type { GraphicsState } from '../rendering/GraphicsState';
