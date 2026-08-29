/**
 * Feature 契约与运行时上下文。
 *
 * Feature 是 @threxus/runtime 的扩展单元：每个 Feature 声明自己提供/依赖的服务，
 * 在 `setup()` 中通过 {@link ThreeContext} 注册资源并注入依赖。
 *
 * 声明式契约（provides / dependencies / optionalDependencies）在启动前由
 * {@link FeatureGraph} 解析为拓扑序；运行时 {@link ThreeApp} 强制校验
 * provide/inject 与声明一致。
 */

import type { Cleanup, Disposable } from '../lifecycle/Disposable';
import type {
  FixedUpdateCallback,
  RenderCallback,
  TaskOptions,
  UpdateCallback,
} from '../scheduler/SchedulerTask';
import type { ServiceKey } from '../services/ServiceKey';

/** 服务注册选项。 */
export interface ProvideServiceOptions {
  /**
   * 服务从容器移除时的释放策略。
   * - `auto`（默认）：若 service 实现了 Disposable，自动调用 dispose。
   * - `manual`：仅移除容器条目，由 Feature 自行管理释放。
   */
  readonly dispose?: 'auto' | 'manual';
}

/**
 * Feature setup 期间可用的上下文。
 *
 * 所有操作都受 FeatureScope 生命周期约束：
 * - `signal`：Feature 级 AbortSignal，dispose 时 abort。
 * - `addCleanup`：注册 LIFO 清理项。
 * - `provide` / `inject`：受 Feature 声明的服务契约约束。
 */
export interface ThreeContext {
  readonly canvas: HTMLCanvasElement;
  /** Feature 级取消信号；App dispose 或 Feature 回滚时触发。 */
  readonly signal: AbortSignal;

  provide<T>(
    key: ServiceKey<T>,
    service: T,
    options?: ProvideServiceOptions,
  ): void;
  inject<T>(key: ServiceKey<T>): T;
  injectOptional<T>(key: ServiceKey<T>): T | undefined;
  addCleanup(cleanup: Cleanup): Disposable;

  /** 每帧 update 阶段回调；注册自动加入当前 FeatureScope。 */
  onUpdate(callback: UpdateCallback, options?: TaskOptions): Disposable;
  /** 固定时间步回调；需在 createThreeApp 中配置 fixedStep。 */
  onFixedUpdate(
    callback: FixedUpdateCallback,
    options?: TaskOptions,
  ): Disposable;
  onBeforeRender(callback: RenderCallback, options?: TaskOptions): Disposable;
  onAfterRender(callback: RenderCallback, options?: TaskOptions): Disposable;
  /** 按需渲染模式下请求下一帧；同 tick 多次调用合并。 */
  invalidate(): void;
}

/**
 * Feature 定义。
 *
 * 实现约定：
 * - `name` 全局唯一，用于日志、错误信息和 inspect。
 * - `provides` 中声明的每个 Key 必须在 setup 内调用 `ctx.provide()`。
 * - `inject` / `injectOptional` 只能访问 dependencies + optionalDependencies + provides 中声明的 Key。
 * - setup 可以是 async；若 App 在 starting 期间 dispose，应通过 signal 协作取消。
 */
export interface ThreeFeature {
  /** 唯一名称，不可为空。 */
  readonly name: string;
  /** 本 Feature 提供的服务列表。 */
  readonly provides?: readonly ServiceKey<unknown>[];
  /** 必需依赖；缺失提供者时启动失败。 */
  readonly dependencies?: readonly ServiceKey<unknown>[];
  /** 可选依赖；无提供者时 injectOptional 返回 undefined。 */
  readonly optionalDependencies?: readonly ServiceKey<unknown>[];

  setup(context: ThreeContext): void | Promise<void>;
}
