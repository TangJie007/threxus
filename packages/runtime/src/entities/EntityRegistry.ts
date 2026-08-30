import type { Object3D } from 'three';
import type { AssetManager } from '../assets';
import { ThrexusError, toError } from '../errors';
import type { FeatureScope } from '../feature/FeatureScope';
import { CleanupStack } from '../lifecycle/CleanupStack';
import type { Cleanup, Disposable } from '../lifecycle/Disposable';
import type { RenderingRuntime } from '../rendering/RenderingRuntime';
import type { Scheduler } from '../scheduler/Scheduler';
import type {
  EntityContext,
  EntityCreateResult,
  EntityDefinition,
  EntityHandle,
  EntityState,
  SpawnEntityOptions,
} from './EntityDefinition';

export interface EntitySnapshot {
  readonly id: string;
  readonly type: string;
  readonly state: EntityState;
  readonly ownerFeature: string;
}

export interface EntityRegistryDeps {
  readonly canvas: HTMLCanvasElement;
  readonly assets: AssetManager;
  readonly scheduler: Scheduler;
  readonly getRendering: () => RenderingRuntime;
}

/** App 级实体注册表；实体生命周期仍归创建它的 FeatureScope 所有。 */
export class EntityRegistry implements Disposable {
  readonly #entries = new Map<string, RegisteredEntity>();
  readonly #sequences = new Map<string, number>();
  readonly #deps: EntityRegistryDeps;

  constructor(deps: EntityRegistryDeps) {
    this.#deps = deps;
  }

  get size(): number {
    return this.#entries.size;
  }

  async spawn<TProps, TApi>(
    scope: FeatureScope,
    definition: EntityDefinition<TProps, TApi>,
    props: TProps,
    options: SpawnEntityOptions = {},
  ): Promise<EntityHandle<TApi>> {
    const id = options.id ?? this.#nextId(definition.type);
    if (!id.trim()) {
      throw new ThrexusError(
        'ENTITY_STATE',
        'Entity id must be a non-empty string.',
      );
    }
    if (this.#entries.has(id)) {
      throw new ThrexusError(
        'ENTITY_STATE',
        `Entity "${id}" is already registered.`,
      );
    }

    const runtime = new EntityRuntime<TProps, TApi>({
      id,
      ownerFeature: scope.feature.name,
      definition,
      props,
      ...(options.parent ? { parent: options.parent } : {}),
      parentSignal: scope.signal,
      deps: this.#deps,
      unregister: () => {
        if (this.#entries.get(id) === runtime) {
          this.#entries.delete(id);
        }
      },
    });

    this.#entries.set(id, runtime);
    scope.addCleanup(runtime);

    try {
      await runtime.start();
      return runtime.handle;
    } catch (error) {
      try {
        await runtime.dispose();
      } catch {
        // 创建错误优先；清理错误由实体自身状态与后续 Scope dispose 处理。
      }
      throw error;
    }
  }

  inspect(): readonly EntitySnapshot[] {
    return [...this.#entries.values()]
      .map((entry) => entry.snapshot())
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async dispose(): Promise<void> {
    const errors: Error[] = [];
    for (const entry of [...this.#entries.values()].reverse()) {
      try {
        await entry.dispose();
      } catch (error) {
        errors.push(toError(error));
      }
    }
    this.#entries.clear();
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Entity registry disposal failed.');
    }
  }

  #nextId(type: string): string {
    const next = (this.#sequences.get(type) ?? 0) + 1;
    this.#sequences.set(type, next);
    return `${type}#${next}`;
  }
}

interface EntityRuntimeOptions<TProps, TApi> {
  readonly id: string;
  readonly ownerFeature: string;
  readonly definition: EntityDefinition<TProps, TApi>;
  readonly props: TProps;
  readonly parent?: Object3D;
  readonly parentSignal: AbortSignal;
  readonly deps: EntityRegistryDeps;
  readonly unregister: () => void;
}

interface RegisteredEntity extends Disposable {
  snapshot(): EntitySnapshot;
}

class EntityRuntime<TProps, TApi> implements RegisteredEntity {
  readonly id: string;
  readonly type: string;
  readonly ownerFeature: string;
  readonly #cleanup = new CleanupStack();
  readonly #controller = new AbortController();
  readonly #options: EntityRuntimeOptions<TProps, TApi>;
  #state: EntityState = 'creating';
  #root: Object3D | undefined;
  #api: TApi | undefined;
  #startPromise: Promise<void> | undefined;
  #disposePromise: Promise<void> | undefined;

  constructor(options: EntityRuntimeOptions<TProps, TApi>) {
    this.id = options.id;
    this.type = options.definition.type;
    this.ownerFeature = options.ownerFeature;
    this.#options = options;

    const abortFromParent = () => {
      this.#controller.abort(options.parentSignal.reason);
    };
    if (options.parentSignal.aborted) {
      abortFromParent();
    } else {
      options.parentSignal.addEventListener('abort', abortFromParent, {
        once: true,
      });
      this.#cleanup.add(() => {
        options.parentSignal.removeEventListener('abort', abortFromParent);
      });
    }
  }

  get handle(): EntityHandle<TApi> {
    const runtime = this;
    return {
      id: this.id,
      type: this.type,
      get root() {
        return runtime.#requireRoot();
      },
      get api() {
        return runtime.#api as TApi;
      },
      get state() {
        return runtime.#state;
      },
      dispose: () => runtime.dispose(),
    } as EntityHandle<TApi>;
  }

  start(): Promise<void> {
    this.#startPromise ??= this.#runStart();
    return this.#startPromise;
  }

  snapshot(): EntitySnapshot {
    return {
      id: this.id,
      type: this.type,
      state: this.#state,
      ownerFeature: this.ownerFeature,
    };
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }
    this.#state = 'disposing';
    this.#controller.abort(
      new ThrexusError(
        'ENTITY_STATE',
        `Entity "${this.id}" is being disposed.`,
      ),
    );
    this.#disposePromise = this.#runDispose();
    return this.#disposePromise;
  }

  async #runStart(): Promise<void> {
    try {
      const result = await this.#options.definition.create(
        this.#createContext(),
        this.#options.props,
      );
      this.#registerResult(result);

      if (this.#controller.signal.aborted) {
        throw this.#controller.signal.reason;
      }
      this.#state = 'active';
    } catch (error) {
      if (this.#state !== 'disposing') {
        this.#state = 'failed';
      }
      const cause = toError(error);
      throw new ThrexusError(
        'ENTITY_SETUP',
        `Failed to create entity "${this.id}": ${cause.message}`,
        { cause },
      );
    }
  }

  async #runDispose(): Promise<void> {
    try {
      if (this.#startPromise) {
        try {
          await this.#startPromise;
        } catch {
          // 创建失败后仍须清理由 EntityContext 已登记的资源。
        }
      }
      await this.#cleanup.dispose();
      this.#state = 'disposed';
    } catch (error) {
      this.#state = 'failed';
      throw error;
    } finally {
      this.#options.unregister();
    }
  }

  #createContext(): EntityContext {
    const rendering = () => this.#options.deps.getRendering();
    const addCleanup = (cleanup: Cleanup): Disposable =>
      this.#cleanup.add(cleanup);

    return {
      canvas: this.#options.deps.canvas,
      scene: rendering().scene,
      camera: rendering().camera,
      renderer: rendering().renderer,
      assets: this.#options.deps.assets,
      signal: this.#controller.signal,
      addCleanup,
      retain: (handle) => {
        addCleanup(() => handle.dispose());
      },
      own: (object) => {
        addCleanup(() => {
          object.removeFromParent();
        });
      },
      onUpdate: (callback, options) => {
        const task = this.#options.deps.scheduler.onUpdate(
          `${this.ownerFeature}:${this.id}`,
          callback,
          options,
        );
        return addCleanup(task);
      },
      invalidate: () => {
        this.#options.deps.scheduler.invalidate();
      },
    };
  }

  #registerResult(result: EntityCreateResult<TApi>): void {
    this.#root = result.root;
    this.#api = result.api as TApi;

    if (result.dispose) {
      this.#cleanup.add(result.dispose);
    }

    const parent = this.#options.parent ?? this.#options.deps.getRendering().scene;
    parent.add(result.root);
    this.#cleanup.add(() => {
      result.root.removeFromParent();
    });

    if (result.update) {
      const task = this.#options.deps.scheduler.onUpdate(
        `${this.ownerFeature}:${this.id}`,
        result.update,
      );
      this.#cleanup.add(task);
    }
  }

  #requireRoot(): Object3D {
    if (!this.#root) {
      throw new ThrexusError(
        'ENTITY_STATE',
        `Entity "${this.id}" has not finished creating.`,
      );
    }
    return this.#root;
  }
}
