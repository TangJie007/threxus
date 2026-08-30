/**
 * ThreeAppRuntime：App 状态机与 Feature 安装编排。
 *
 * 职责：
 * - 收集 Feature（use）并在 start 时按依赖拓扑序依次 setup
 * - 维护 App 级 ServiceContainer 与 FeatureScope 列表
 * - 协调 start / dispose 并发、启动失败回滚、dispose 期间 abort
 *
 * 销毁顺序：成功安装的 Feature 按安装逆序 dispose；Scope 内 LIFO cleanup。
 */

import type { Camera, Scene, WebGLRenderer } from 'three';
import { keyBy } from 'es-toolkit';
import type { AssetManager } from '../../assets';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { ThrexusError, toError } from '../../errors';
import { FeatureRegistry } from '../../feature/FeatureRegistry';
import { FeatureScope } from '../../feature/FeatureScope';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import type { InputManager } from '../../input';
import type { GraphicsState } from '../../rendering/GraphicsState';
import type { RenderingRuntime } from '../../rendering/RenderingRuntime';
import type { Scheduler } from '../../scheduler/Scheduler';
import { ServiceContainer } from '../../services/ServiceContainer';
import {
  shouldEnableLifecycleWarnings,
  warnLifecycle,
  type Logger,
} from '../../diagnostics';
import {
  createAppAssets,
  createAppScheduler,
  createInputSubsystem,
  createRenderingSubsystem,
  type PendingCamera,
} from '../bootstrap';
import {
  createThreeContext,
  verifyProvidedServices,
} from '../context';
import type { AppState } from '../types/AppState';
import type { ThreeApp } from '../types/ThreeApp';
import type {
  RuntimeSnapshot,
  SetCameraOptions,
  ThreeAppOptions,
} from '../types/ThreeAppOptions';

export class ThreeAppRuntime implements ThreeApp {
  readonly #registry = new FeatureRegistry();
  readonly #services = new ServiceContainer();
  /** 注册顺序列表，供 inspect 展示尚未 setup 的 Feature。 */
  readonly #registered: ThreeFeature[] = [];
  /** 已进入 setup 的 Scope，顺序与拓扑安装序一致。 */
  readonly #scopes: FeatureScope[] = [];
  /** App 级 AbortController；dispose 在 starting 期间也会触发 abort。 */
  readonly #controller = new AbortController();
  readonly #scheduler: Scheduler;
  readonly #assets: AssetManager;
  readonly #entities: EntityRegistry;
  readonly #rendererBinding: import('../../assets').RendererBinding;
  readonly #disposeAssetLoaders: () => void;
  readonly #logger: Logger | undefined;
  readonly #lifecycleWarnings: boolean;
  #input: InputManager | undefined;
  #rendering: RenderingRuntime | undefined;
  #pendingCamera: PendingCamera | undefined;
  #state: AppState = 'created';
  #graphicsState: GraphicsState = 'available';
  /** 并发 start() 共享同一 Promise。 */
  #startPromise: Promise<void> | undefined;
  /** 并发 dispose() 共享同一 Promise。 */
  #disposePromise: Promise<void> | undefined;

  constructor(readonly options: ThreeAppOptions) {
    this.#logger = options.diagnostics?.logger;
    this.#lifecycleWarnings = shouldEnableLifecycleWarnings(
      options.diagnostics?.lifecycleWarnings,
    );
    this.#scheduler = createAppScheduler(
      options,
      () => this.#state === 'running' && this.#graphicsState === 'available',
    );
    const assetBundle = createAppAssets(options);
    this.#assets = assetBundle.assets;
    this.#rendererBinding = assetBundle.rendererBinding;
    this.#disposeAssetLoaders = () => assetBundle.disposeLoaders();
    this.#entities = new EntityRegistry({
      canvas: options.canvas,
      assets: this.#assets,
      scheduler: this.#scheduler,
      getRendering: () => this.#requireRendering(),
    });
  }

  get state(): AppState {
    return this.#state;
  }

  get graphicsState(): GraphicsState {
    return this.#graphicsState;
  }

  get canvas(): HTMLCanvasElement {
    return this.options.canvas;
  }

  get scene(): Scene {
    return this.#requireRendering().scene;
  }

  get camera(): Camera {
    return this.#requireRendering().camera;
  }

  get renderer(): WebGLRenderer {
    return this.#requireRendering().renderer;
  }

  get assets(): AssetManager {
    return this.#assets;
  }

  use(feature: ThreeFeature): this {
    if (this.#state !== 'created') {
      if (this.#lifecycleWarnings) {
        warnLifecycle(
          this.#logger,
          `use("${feature.name}") called while app is ${this.#state}; features must be registered before start().`,
        );
      }
      throw new ThrexusError(
        'APP_STATE',
        `Cannot register feature "${feature.name}" while app is ${this.#state}.`,
      );
    }

    this.#registry.add(feature);
    this.#registered.push(feature);
    return this;
  }

  async installFeature(feature: ThreeFeature): Promise<void> {
    if (this.#state !== 'running' && this.#state !== 'paused') {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot installFeature while app is ${this.#state}. Use use() before start(), or install while running/paused.`,
      );
    }

    if (this.#registered.some((item) => item.name === feature.name)) {
      throw new ThrexusError(
        'DUPLICATE_FEATURE',
        `Feature "${feature.name}" is already installed.`,
      );
    }

    for (const key of feature.provides ?? []) {
      if (this.#services.has(key)) {
        throw new ThrexusError(
          'DUPLICATE_SERVICE',
          `Service "${key.description}" is already provided; cannot install "${feature.name}".`,
        );
      }
    }

    for (const key of feature.dependencies ?? []) {
      if (!this.#services.has(key)) {
        throw new ThrexusError(
          'MISSING_SERVICE',
          `Cannot install "${feature.name}": missing required service "${key.description}".`,
        );
      }
    }

    const scope = new FeatureScope(feature);
    this.#scopes.push(scope);
    this.#registered.push(feature);

    const context = createThreeContext(scope, {
      canvas: this.canvas,
      assets: this.#assets,
      entities: this.#entities,
      services: this.#services,
      scheduler: this.#scheduler,
      getRendering: () => this.#requireRendering(),
      getInput: () => this.#requireInput(),
    });

    try {
      await feature.setup(context);
      verifyProvidedServices(scope);
      scope.activate();
    } catch (error) {
      this.#scopes.pop();
      this.#registered.pop();
      this.#services.removeOwner(feature.name);
      try {
        await scope.dispose();
      } catch {
        // ignore rollback dispose errors
      }
      const cause = toError(error);
      throw new ThrexusError(
        'FEATURE_SETUP',
        `Failed to install feature "${feature.name}": ${cause.message}`,
        { cause },
      );
    }
  }

  async uninstallFeature(name: string): Promise<void> {
    if (this.#state !== 'running' && this.#state !== 'paused') {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot uninstallFeature while app is ${this.#state}.`,
      );
    }

    const scopeIndex = this.#scopes.findIndex(
      (scope) => scope.feature.name === name,
    );
    if (scopeIndex < 0) {
      throw new ThrexusError(
        'APP_STATE',
        `Feature "${name}" is not installed.`,
      );
    }

    const target = this.#scopes[scopeIndex]!;
    const provided = new Set(
      (target.feature.provides ?? []).map((key) => key.id),
    );

    for (const other of this.#scopes) {
      if (other.feature.name === name) {
        continue;
      }
      for (const key of other.feature.dependencies ?? []) {
        if (provided.has(key.id)) {
          throw new ThrexusError(
            'APP_STATE',
            `Cannot uninstall "${name}": feature "${other.feature.name}" still depends on "${key.description}".`,
          );
        }
      }
    }

    this.#scopes.splice(scopeIndex, 1);
    const registeredIndex = this.#registered.findIndex(
      (feature) => feature.name === name,
    );
    if (registeredIndex >= 0) {
      this.#registered.splice(registeredIndex, 1);
    }

    try {
      await target.dispose();
    } finally {
      this.#services.removeOwner(name);
    }
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

  render(): void {
    if (this.#state !== 'running' && this.#state !== 'paused') {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot render while app is ${this.#state}.`,
      );
    }
    this.#requireRendering().render();
  }

  setCamera(camera: Camera, options?: SetCameraOptions): void {
    const ownership = options?.ownership ?? 'external';
    if (
      this.#state !== 'created' &&
      this.#state !== 'starting' &&
      this.#state !== 'running' &&
      this.#state !== 'paused'
    ) {
      throw new ThrexusError(
        'APP_STATE',
        `Cannot set camera while app is ${this.#state}.`,
      );
    }

    if (this.#rendering) {
      this.#rendering.setCamera(camera, ownership);
      this.#scheduler.invalidate();
      return;
    }

    this.#pendingCamera = { camera, ownership };
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }

    if (this.#state === 'disposed') {
      return Promise.resolve();
    }

    this.#state = 'disposing';
    if (this.#lifecycleWarnings) {
      this.#logger?.info('Application disposing.');
    }
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
    const serviceEntries = this.#services.inspect();
    const entities = this.#entities.inspect();
    const activeFeatures = this.#scopes.filter(
      (scope) => scope.state === 'active',
    ).length;

    return {
      state: this.#state,
      graphicsState: this.#graphicsState,
      services: serviceEntries.length,
      counts: {
        features: this.#registered.length,
        activeFeatures,
        services: serviceEntries.length,
        entities: entities.length,
      },
      serviceEntries,
      entities,
      scheduler: this.#scheduler.inspect(),
      rendering: this.#rendering?.inspect() ?? null,
      assets: this.#assets.inspect(),
      input: this.#input?.inspect() ?? null,
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

  simulateContextLost(): void {
    this.#requireRendering().simulateContextLost();
  }

  simulateContextRestored(): Promise<void> {
    return this.#requireRendering().simulateContextRestored();
  }

  /**
   * 启动主流程：解析图 → 按序 setup → 校验契约 → activate。
   * 任一步失败则回滚已安装的 Scope，App 进入 failed（除非 dispose 抢先）。
   */
  async #runStart(): Promise<void> {
    try {
      const graph = this.#registry.lockAndResolve();
      this.#initializeSubsystems();

      for (const feature of graph.ordered) {
        this.#throwIfAborted();
        const scope = new FeatureScope(feature);
        this.#scopes.push(scope);

        const context = createThreeContext(scope, {
          canvas: this.canvas,
          assets: this.#assets,
          entities: this.#entities,
          services: this.#services,
          scheduler: this.#scheduler,
          getRendering: () => this.#requireRendering(),
          getInput: () => this.#requireInput(),
        });

        try {
          await feature.setup(context);
          this.#throwIfAborted();
          verifyProvidedServices(scope);
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
      this.#disposeInput();
      await this.#disposeRendering();
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
    try {
      await this.#entities.dispose();
    } catch (error) {
      errors.push(toError(error));
    }
    this.#disposeInput();
    await this.#disposeRendering();
    this.#rendererBinding.current = undefined;
    this.#disposeAssetLoaders();
    this.#scheduler.dispose();
    try {
      await this.#assets.dispose();
    } catch (error) {
      errors.push(toError(error));
    }
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

  #initializeSubsystems(): void {
    this.#rendering = createRenderingSubsystem(
      this.options,
      this.#pendingCamera,
      (state) => {
        this.#graphicsState = state;
        if (state === 'available' && this.#state === 'running') {
          this.#scheduler.invalidate();
        }
      },
    );
    this.#pendingCamera = undefined;
    this.#graphicsState = this.#rendering.graphicsState;
    this.#rendererBinding.current = this.#rendering.renderer;

    this.#scheduler.setRenderHook(() => {
      this.#rendering?.render();
    });

    this.#input = createInputSubsystem(this.options, () =>
      this.#requireRendering().camera,
    );
  }

  #disposeInput(): void {
    if (!this.#input) {
      return;
    }
    this.#input.dispose();
    this.#input = undefined;
  }

  async #disposeRendering(): Promise<void> {
    if (!this.#rendering) {
      return;
    }
    this.#rendering.dispose();
    this.#rendering = undefined;
  }

  #requireRendering(): RenderingRuntime {
    if (!this.#rendering) {
      throw new ThrexusError(
        'APP_STATE',
        'Rendering is not initialized. Call start() first.',
      );
    }
    return this.#rendering;
  }

  #requireInput(): InputManager {
    if (!this.#input) {
      throw new ThrexusError(
        'APP_STATE',
        'Input is not initialized. Call start() first.',
      );
    }
    return this.#input;
  }

  /** dispose 在 starting 期间 abort 后，setup 循环应中断并进入回滚。 */
  #throwIfAborted(): void {
    if (this.#controller.signal.aborted) {
      throw this.#controller.signal.reason;
    }
  }
}
