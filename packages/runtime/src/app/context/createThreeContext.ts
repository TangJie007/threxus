/**
 * 为 Feature 构造有作用域的 ThreeContext。
 *
 * 契约：
 * - provide 仅限 declares provides 中的 Key
 * - inject / injectOptional 仅限 dependencies + optional + provides
 * - provide 时自动注册 cleanup：移除容器条目 + 可选 auto dispose
 */

import type { AssetHandle, AssetManager } from '../../assets';
import { ThrexusError } from '../../errors';
import type { FeatureScope } from '../../feature/FeatureScope';
import type {
  ProvideServiceOptions,
  ThreeContext,
} from '../../feature/ThreeFeature';
import type { InputManager } from '../../input';
import {
  isDisposable,
  type Cleanup,
  type Disposable,
} from '../../lifecycle/Disposable';
import type { RenderingRuntime } from '../../rendering/RenderingRuntime';
import type { Scheduler } from '../../scheduler/Scheduler';
import type {
  FixedUpdateCallback,
  RenderCallback,
  TaskOptions,
  UpdateCallback,
} from '../../scheduler/SchedulerTask';
import type { ServiceContainer } from '../../services/ServiceContainer';
import type { ServiceKey } from '../../services/ServiceKey';

export interface CreateThreeContextDeps {
  readonly canvas: HTMLCanvasElement;
  readonly assets: AssetManager;
  readonly services: ServiceContainer;
  readonly scheduler: Scheduler;
  readonly getRendering: () => RenderingRuntime;
  readonly getInput: () => InputManager;
}

export function createThreeContext(
  scope: FeatureScope,
  deps: CreateThreeContextDeps,
): ThreeContext {
  const feature = scope.feature;
  const declaredDependencies = new Set([
    ...(feature.dependencies ?? []).map((key) => key.id),
    ...(feature.optionalDependencies ?? []).map((key) => key.id),
    ...(feature.provides ?? []).map((key) => key.id),
  ]);
  const declaredServices = new Set(
    (feature.provides ?? []).map((key) => key.id),
  );

  const rendering = () => deps.getRendering();

  return {
    canvas: deps.canvas,
    scene: rendering().scene,
    camera: rendering().camera,
    renderer: rendering().renderer,
    assets: deps.assets,
    input: deps.getInput().createScope(scope),
    rendering: rendering().createScope(scope),
    signal: scope.signal,

    addCleanup: (cleanup: Cleanup): Disposable => scope.addCleanup(cleanup),

    retain: <T>(handle: AssetHandle<T>): void => {
      scope.addCleanup(() => {
        handle.dispose();
      });
    },

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

      deps.services.provide(feature.name, key, service);
      scope.recordProvided(key);
      scope.addCleanup(async () => {
        deps.services.remove(feature.name, key);
        if (options?.dispose !== 'manual' && isDisposable(service)) {
          await service.dispose();
        }
      });
    },

    inject: <T>(key: ServiceKey<T>): T => {
      assertDeclaredDependency(feature.name, key, declaredDependencies);
      return deps.services.get(key);
    },

    injectOptional: <T>(key: ServiceKey<T>): T | undefined => {
      assertDeclaredDependency(feature.name, key, declaredDependencies);
      return deps.services.getOptional(key);
    },

    onUpdate: (callback: UpdateCallback, options?: TaskOptions): Disposable =>
      registerSchedulerTask(scope, () =>
        deps.scheduler.onUpdate(feature.name, callback, options),
      ),

    onFixedUpdate: (
      callback: FixedUpdateCallback,
      options?: TaskOptions,
    ): Disposable =>
      registerSchedulerTask(scope, () =>
        deps.scheduler.onFixedUpdate(feature.name, callback, options),
      ),

    onBeforeRender: (
      callback: RenderCallback,
      options?: TaskOptions,
    ): Disposable =>
      registerSchedulerTask(scope, () =>
        deps.scheduler.onBeforeRender(feature.name, callback, options),
      ),

    onAfterRender: (
      callback: RenderCallback,
      options?: TaskOptions,
    ): Disposable =>
      registerSchedulerTask(scope, () =>
        deps.scheduler.onAfterRender(feature.name, callback, options),
      ),

    invalidate: (): void => {
      deps.scheduler.invalidate();
    },

    own: (object): void => {
      rendering().own(scope, object);
    },

    onCameraChanged: (callback) => {
      const disposable = rendering().onCameraChanged(callback);
      scope.addCleanup(disposable);
      return disposable;
    },
  };
}

/** 确保 declares provides 的每个 Key 都在 setup 中实际 provide 了。 */
export function verifyProvidedServices(scope: FeatureScope): void {
  for (const key of scope.feature.provides ?? []) {
    if (!scope.hasProvided(key)) {
      throw new ThrexusError(
        'SERVICE_CONTRACT',
        `Feature "${scope.feature.name}" declared but did not provide service "${key.description}".`,
      );
    }
  }
}

function registerSchedulerTask(
  scope: FeatureScope,
  register: () => Disposable,
): Disposable {
  const disposable = register();
  scope.addCleanup(disposable);
  return disposable;
}

function assertDeclaredDependency(
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
