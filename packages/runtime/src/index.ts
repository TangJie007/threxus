/**
 * @threxus/runtime 公共 API 入口。
 *
 * 当前阶段（M0–M4）导出：
 * - ThreeApp 工厂与类型
 * - Feature 契约（ThreeFeature / ThreeContext）
 * - Scheduler 与帧回调类型
 * - 生命周期原语（CleanupStack / Disposable）
 * - 服务标识（createServiceKey）
 * - 运行时错误（ThrexusError）
 *
 * 内部模块（FeatureGraph、FeatureRegistry、FeatureScope、ServiceContainer）
 * 不对外暴露，由 ThreeApp 编排使用。
 *
 * 运行时依赖 es-toolkit（按需 import，tree-shake 友好）。
 */

export {
  createThreeApp,
  type AppState,
  type FeatureSnapshot,
  type RuntimeSnapshot,
  type ThreeApp,
  type ThreeAppOptions,
} from './app/ThreeApp';
export {
  type ProvideServiceOptions,
  type ThreeContext,
  type ThreeFeature,
} from './feature/ThreeFeature';
export {
  CleanupStack,
  type CleanupStackState,
} from './lifecycle/CleanupStack';
export {
  type Cleanup,
  type Disposable,
  isDisposable,
} from './lifecycle/Disposable';
export {
  Scheduler,
  type RenderMode,
  type SchedulerErrorPolicy,
  type SchedulerOptions,
  type SchedulerSnapshot,
} from './scheduler/Scheduler';
export type { FrameInfo } from './scheduler/FrameInfo';
export {
  createBrowserRafDriver,
  ManualRafDriver,
  type RafDriver,
} from './scheduler/RafDriver';
export type {
  FixedUpdateCallback,
  RenderCallback,
  SchedulerPhase,
  TaskOptions,
  UpdateCallback,
} from './scheduler/SchedulerTask';
export {
  createServiceKey,
  type ServiceKey,
} from './services/ServiceKey';
export { ThrexusError, type ThrexusErrorCode } from './errors';
