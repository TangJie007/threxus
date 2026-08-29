import { ThrexusError, toError } from '../errors';
import { FeatureRegistry } from '../feature/FeatureRegistry';
import { FeatureScope, type FeatureScopeState } from '../feature/FeatureScope';
import type {
  ProvideServiceOptions,
  ThreeContext,
  ThreeFeature,
} from '../feature/ThreeFeature';
import { isDisposable, type Cleanup, type Disposable } from '../lifecycle/Disposable';
import { ServiceContainer } from '../services/ServiceContainer';
import type { ServiceKey } from '../services/ServiceKey';

export type AppState =
  | 'created'
  | 'starting'
  | 'running'
  | 'paused'
  | 'disposing'
  | 'disposed'
  | 'failed';

export interface ThreeAppOptions {
  readonly canvas: HTMLCanvasElement;
}

export interface FeatureSnapshot {
  readonly name: string;
  readonly state: FeatureScopeState | 'registered';
  readonly cleanupCount: number;
}

export interface RuntimeSnapshot {
  readonly state: AppState;
  readonly services: number;
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

export function createThreeApp(options: ThreeAppOptions): ThreeApp {
  if (!options.canvas) {
    throw new TypeError('createThreeApp requires a canvas.');
  }

  return new ThreeAppRuntime(options);
}

class ThreeAppRuntime implements ThreeApp {
  readonly #registry = new FeatureRegistry();
  readonly #services = new ServiceContainer();
  readonly #registered: ThreeFeature[] = [];
  readonly #scopes: FeatureScope[] = [];
  readonly #controller = new AbortController();
  #state: AppState = 'created';
  #startPromise: Promise<void> | undefined;
  #disposePromise: Promise<void> | undefined;

  constructor(readonly options: ThreeAppOptions) {}

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
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }

    if (this.#state === 'disposed') {
      return Promise.resolve();
    }

    this.#state = 'disposing';
    this.#controller.abort(new Error('Application is being disposed.'));
    for (const scope of this.#scopes) {
      scope.abort(this.#controller.signal.reason);
    }

    this.#disposePromise = this.#runDispose();
    return this.#disposePromise;
  }

  inspect(): RuntimeSnapshot {
    const scopesByName = new Map(
      this.#scopes.map((scope) => [scope.feature.name, scope]),
    );

    return {
      state: this.#state,
      services: this.#services.size,
      features: this.#registered.map((feature) => {
        const scope = scopesByName.get(feature.name);
        return {
          name: feature.name,
          state: scope?.state ?? 'registered',
          cleanupCount: scope?.cleanupCount ?? 0,
        };
      }),
    };
  }

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

  async #runDispose(): Promise<void> {
    if (this.#startPromise) {
      try {
        await this.#startPromise;
      } catch {
        // Startup owns its error; disposal still completes all cleanup.
      }
    }

    const errors = await this.#disposeScopes();
    this.#services.clear();
    this.#state = 'disposed';

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Application disposal failed.');
    }
  }

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
    };
  }

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

  #throwIfAborted(): void {
    if (this.#controller.signal.aborted) {
      throw this.#controller.signal.reason;
    }
  }
}
