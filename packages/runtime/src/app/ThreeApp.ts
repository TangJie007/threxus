/**
 * ThreeApp：运行时入口与状态机。
 *
 * 职责：
 * - 收集 Feature（use）并在 start 时按依赖拓扑序依次 setup。
 * - 维护 App 级 ServiceContainer 与 FeatureScope 列表。
 * - 协调 start / dispose 并发、启动失败回滚、dispose 期间 abort。
 *
 * App 状态机：
 * ```text
 * created → starting → running ⇄ paused
 *              ↓           ↓
 *           failed    disposing → disposed
 * ```
 *
 * 销毁顺序：
 * - 成功安装的 Feature 按**安装顺序的逆序** dispose（后装先拆）。
 * - 每个 Scope dispose 时 LIFO 执行其 cleanup，并 removeOwner 对应服务。
 *
 * M4 增加 Scheduler / RAF；WebGL Renderer 属于 M5。
 */

import { keyBy } from 'es-toolkit';
import { ThrexusError, toError } from '../errors';
import { FeatureRegistry } from '../feature/FeatureRegistry';
import { FeatureScope, type FeatureScopeState } from '../feature/FeatureScope';
import type {
  ProvideServiceOptions,
  ThreeContext,
  ThreeFeature,
} from '../feature/ThreeFeature';
import { isDisposable, type Cleanup, type Disposable } from '../lifecycle/Disposable';
import {
  Scheduler,
  type RenderMode,
  type SchedulerErrorPolicy,
  type SchedulerSnapshot,
} from '../scheduler/Scheduler';
import type { RafDriver } from '../scheduler/RafDriver';
import type {
  FixedUpdateCallback,
  RenderCallback,
  TaskOptions,
  UpdateCallback,
} from '../scheduler/SchedulerTask';
import { ServiceContainer } from '../services/ServiceContainer';
import type { ServiceKey } from '../services/ServiceKey';

/** App 生命周期状态。详见文件头状态机图。 */
export type AppState =
  /** 已创建，可 use / start / dispose。 */
  | 'created'
  /** 正在启动：解析依赖图、按序 setup Feature。 */
  | 'starting'
  /** 启动成功，所有 Feature 已 activate。 */
  | 'running'
  /** 已暂停；取消 RAF，resume 后恢复调度。 */
  | 'paused'
  /** 正在销毁：abort → 逆序 dispose Scope → 清空服务。 */
  | 'disposing'
  /** 已完全销毁（终态）。 */
  | 'disposed'
  /** 启动失败且已回滚（终态，不可 restart，需 dispose 或重建 App）。 */
  | 'failed';

export interface ThreeAppOptions {
  readonly canvas: HTMLCanvasElement;
  /** 连续渲染（默认）或按需 invalidate。 */
  readonly renderMode?: RenderMode;
  /** 固定时间步（秒）；设置后启用 onFixedUpdate。 */
  readonly fixedStep?: number;
  /** 单帧 delta 上限（秒），默认 0.1。 */
  readonly maxDelta?: number;
  /** 单帧 fixedUpdate 最大迭代次数，默认 5。 */
  readonly maxFixedStepsPerFrame?: number;
  /** 帧回调异常策略，默认 continue。 */
  readonly errorPolicy?: SchedulerErrorPolicy;
  /** 自定义 RAF 驱动（测试用）。 */
  readonly rafDriver?: RafDriver;
}

/** inspect() 返回的单个 Feature 快照。 */
export interface FeatureSnapshot {
  readonly name: string;
  readonly state: FeatureScopeState | 'registered';
  readonly cleanupCount: number;
}

/** inspect() 返回的运行时快照，供调试与 E2E 断言。 */
export interface RuntimeSnapshot {
  readonly state: AppState;
  readonly services: number;
  readonly scheduler: SchedulerSnapshot;
  readonly features: readonly FeatureSnapshot[];
}

export interface ThreeApp extends Disposable {
  readonly state: AppState;
  readonly canvas: HTMLCanvasElement;

  use(feature: ThreeFeature): this;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  inspect(): RuntimeSnapshot;
}

/** 创建 ThreeApp 实例。canvas 为渲染挂载点（M5 起用于 WebGL）。 */
export function createThreeApp(options: ThreeAppOptions): ThreeApp {
  if (!options.canvas) {
    throw new TypeError('createThreeApp requires a canvas.');
  }

  return new ThreeAppRuntime(options);
}

class ThreeAppRuntime implements ThreeApp {
  readonly #registry = new FeatureRegistry();
  readonly #services = new ServiceContainer();
  /** 注册顺序列表，供 inspect 展示尚未 setup 的 Feature。 */
  readonly #registered: ThreeFeature[] = [];
  /** 已进入 setup 的 Scope，顺序与拓扑安装序一致。 */
  readonly #scopes: FeatureScope[] = [];
  /** App 级 AbortController；dispose 在 starting 期间也会触发 abort。 */
  readonly #controller = new AbortController();
  readonly #scheduler: Scheduler;
  #state: AppState = 'created';
  /** 并发 start() 共享同一 Promise。 */
  #startPromise: Promise<void> | undefined;
  /** 并发 dispose() 共享同一 Promise。 */
  #disposePromise: Promise<void> | undefined;

  constructor(readonly options: ThreeAppOptions) {
    this.#scheduler = new Scheduler({
      shouldRun: () => this.#state === 'running',
      ...(options.renderMode !== undefined
        ? { renderMode: options.renderMode }
        : {}),
      ...(options.fixedStep !== undefined
        ? { fixedStep: options.fixedStep }
        : {}),
      ...(options.maxDelta !== undefined ? { maxDelta: options.maxDelta } : {}),
      ...(options.maxFixedStepsPerFrame !== undefined
        ? { maxFixedStepsPerFrame: options.maxFixedStepsPerFrame }
        : {}),
      ...(options.errorPolicy !== undefined
        ? { errorPolicy: options.errorPolicy }
        : {}),
      ...(options.rafDriver !== undefined
        ? { rafDriver: options.rafDriver }
        : {}),
    });
  }

  get state(): AppState {
    return this.#state;
  }

  get canvas(): HTMLCanvasElement {
    return this.options.canvas;
  }

  use(feature: ThreeFeature): this {
    if (this.#state !== 'created') {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot register feature "${feature.name}" while app is ${this.#state}.`,
      );
    }

    this.#registry.add(feature);
    this.#registered.push(feature);
    return this;
  }

  start(): Promise<void> {
    if (this.#state === 'starting' && this.#startPromise) {
      return this.#startPromise;
    }

    if (this.#state !== 'created') {
      return Promise.reject(
        new ThrexusError(
          'APP_STATE',
          `Cannot start app while it is ${this.#state}.`,
        ),
      );
    }

    this.#state = 'starting';
    this.#startPromise = this.#runStart();
    return this.#startPromise;
  }

  pause(): void {
    if (this.#state === 'paused') {
      return;
    }
    if (this.#state !== 'running') {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot pause app while it is ${this.#state}.`,
      );
    }
    this.#state = 'paused';
    this.#scheduler.pause();
  }

  resume(): void {
    if (this.#state === 'running') {
      return;
    }
    if (this.#state !== 'paused') {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot resume app while it is ${this.#state}.`,
      );
    }
    this.#state = 'running';
    this.#scheduler.resume();
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }

    if (this.#state === 'disposed') {
      return Promise.resolve();
    }

    this.#state = 'disposing';
    this.#scheduler.stop();
    this.#controller.abort(new Error('Application is being disposed.'));
    for (const scope of this.#scopes) {
      scope.abort(this.#controller.signal.reason);
    }

    this.#disposePromise = this.#runDispose();
    return this.#disposePromise;
  }

  inspect(): RuntimeSnapshot {
    const scopesByName = keyBy(this.#scopes, (scope) => scope.feature.name);

    return {
      state: this.#state,
      services: this.#services.size,
      scheduler: this.#scheduler.inspect(),
      features: this.#registered.map((feature) => {
        const scope = scopesByName[feature.name];
        return {
          name: feature.name,
          state: scope?.state ?? 'registered',
          cleanupCount: scope?.cleanupCount ?? 0,
        };
      }),
    };
  }

  /**
   * 启动主流程：解析图 → 按序 setup → 校验契约 → activate。
   * 任一步失败则回滚已安装的 Scope，App 进入 failed（除非 dispose 抢先）。
   */
  async #runStart(): Promise<void> {
    try {
      const graph = this.#registry.lockAndResolve();

      for (const feature of graph.ordered) {
        this.#throwIfAborted();
        const scope = new FeatureScope(feature);
        this.#scopes.push(scope);

        const context = this.#createContext(scope);

        try {
          await feature.setup(context);
          this.#throwIfAborted();
          this.#verifyProvidedServices(scope);
          scope.activate();
        } catch (error) {
          const cause = toError(error);
          throw new ThrexusError(
            'FEATURE_SETUP',
            `Failed to initialize feature "${feature.name}": ${cause.message}`,
            { cause },
          );
        }
      }

      this.#state = 'running';
      this.#scheduler.start();
    } catch (error) {
      const rollbackErrors = await this.#disposeScopes();

      if (this.#state !== 'disposing') {
        this.#state = 'failed';
      }

      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [toError(error), ...rollbackErrors],
          'Application startup and rollback failed.',
        );
      }

      throw error;
    }
  }

  /**
   * 销毁主流程：等待进行中的 start 结束 → 逆序 dispose Scope → 清空容器。
   * start 若失败，此处仍尽力清理已创建的 Scope。
   */
  async #runDispose(): Promise<void> {
    if (this.#startPromise) {
      try {
        await this.#startPromise;
      } catch {
        // 启动错误由 start 调用方处理；dispose 仍继续清理。
      }
    }

    const errors = await this.#disposeScopes();
    this.#scheduler.dispose();
    this.#services.clear();
    this.#state = 'disposed';

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Application disposal failed.');
    }
  }

  /**
   * 逆序销毁所有 Scope，并移除各 Feature 在容器中的服务。
   * 单个 Scope 失败不阻断其余 Scope 的清理。
   */
  async #disposeScopes(): Promise<Error[]> {
    const errors: Error[] = [];

    for (let index = this.#scopes.length - 1; index >= 0; index -= 1) {
      const scope = this.#scopes[index];
      if (!scope) {
        continue;
      }

      try {
        await scope.dispose();
      } catch (error) {
        errors.push(toError(error));
      } finally {
        this.#services.removeOwner(scope.feature.name);
      }
    }

    return errors;
  }

  /**
   * 为 Feature 构造 ThreeContext，并强制执行服务契约：
   * - provide 仅限 declares provides 中的 Key。
   * - inject/injectOptional 仅限 declares dependencies + optional + provides。
   * - provide 时自动注册 cleanup：移除容器条目 + 可选 auto dispose。
   */
  #createContext(scope: FeatureScope): ThreeContext {
    const feature = scope.feature;
    const declaredDependencies = new Set([
      ...(feature.dependencies ?? []).map((key) => key.id),
      ...(feature.optionalDependencies ?? []).map((key) => key.id),
      ...(feature.provides ?? []).map((key) => key.id),
    ]);
    const declaredServices = new Set(
      (feature.provides ?? []).map((key) => key.id),
    );

    return {
      canvas: this.canvas,
      signal: scope.signal,

      addCleanup: (cleanup: Cleanup): Disposable =>
        scope.addCleanup(cleanup),

      provide: <T>(
        key: ServiceKey<T>,
        service: T,
        options?: ProvideServiceOptions,
      ): void => {
        if (!declaredServices.has(key.id)) {
          throw new ThrexusError(
            'SERVICE_CONTRACT',
            `Feature "${feature.name}" provided undeclared service "${key.description}".`,
          );
        }

        this.#services.provide(feature.name, key, service);
        scope.recordProvided(key);
        scope.addCleanup(async () => {
          this.#services.remove(feature.name, key);
          if (options?.dispose !== 'manual' && isDisposable(service)) {
            await service.dispose();
          }
        });
      },

      inject: <T>(key: ServiceKey<T>): T => {
        this.#assertDeclaredDependency(
          feature.name,
          key,
          declaredDependencies,
        );
        return this.#services.get(key);
      },

      injectOptional: <T>(key: ServiceKey<T>): T | undefined => {
        this.#assertDeclaredDependency(
          feature.name,
          key,
          declaredDependencies,
        );
        return this.#services.getOptional(key);
      },

      onUpdate: (callback: UpdateCallback, options?: TaskOptions): Disposable =>
        this.#registerSchedulerTask(scope, () =>
          this.#scheduler.onUpdate(feature.name, callback, options),
        ),

      onFixedUpdate: (
        callback: FixedUpdateCallback,
        options?: TaskOptions,
      ): Disposable =>
        this.#registerSchedulerTask(scope, () =>
          this.#scheduler.onFixedUpdate(feature.name, callback, options),
        ),

      onBeforeRender: (
        callback: RenderCallback,
        options?: TaskOptions,
      ): Disposable =>
        this.#registerSchedulerTask(scope, () =>
          this.#scheduler.onBeforeRender(feature.name, callback, options),
        ),

      onAfterRender: (
        callback: RenderCallback,
        options?: TaskOptions,
      ): Disposable =>
        this.#registerSchedulerTask(scope, () =>
          this.#scheduler.onAfterRender(feature.name, callback, options),
        ),

      invalidate: (): void => {
        this.#scheduler.invalidate();
      },
    };
  }

  /** 注册调度任务并绑定 FeatureScope 生命周期。 */
  #registerSchedulerTask(
    scope: FeatureScope,
    register: () => Disposable,
  ): Disposable {
    const disposable = register();
    scope.addCleanup(disposable);
    return disposable;
  }

  /** 确保 declares provides 的每个 Key 都在 setup 中实际 provide 了。 */
  #verifyProvidedServices(scope: FeatureScope): void {
    for (const key of scope.feature.provides ?? []) {
      if (!scope.hasProvided(key)) {
        throw new ThrexusError(
          'SERVICE_CONTRACT',
          `Feature "${scope.feature.name}" declared but did not provide service "${key.description}".`,
        );
      }
    }
  }

  #assertDeclaredDependency(
    featureName: string,
    key: ServiceKey<unknown>,
    declared: ReadonlySet<symbol>,
  ): void {
    if (!declared.has(key.id)) {
      throw new ThrexusError(
        'SERVICE_CONTRACT',
        `Feature "${featureName}" injected undeclared service "${key.description}".`,
      );
    }
  }

  /** dispose 在 starting 期间 abort 后，setup 循环应中断并进入回滚。 */
  #throwIfAborted(): void {
    if (this.#controller.signal.aborted) {
      throw this.#controller.signal.reason;
    }
  }
}
