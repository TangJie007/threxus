import { ThrexusError } from '../errors';
import { CleanupStack } from '../lifecycle/CleanupStack';
import type { Cleanup, Disposable } from '../lifecycle/Disposable';
import type { ServiceKey } from '../services/ServiceKey';
import type { ThreeFeature } from './ThreeFeature';

export type FeatureScopeState =
  | 'initializing'
  | 'active'
  | 'disposing'
  | 'disposed'
  | 'failed';

export class FeatureScope implements Disposable {
  readonly #controller = new AbortController();
  readonly #cleanups = new CleanupStack();
  readonly #provided = new Set<symbol>();
  #state: FeatureScopeState = 'initializing';
  #disposePromise: Promise<void> | undefined;

  constructor(readonly feature: ThreeFeature) {}

  get state(): FeatureScopeState {
    return this.#state;
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get cleanupCount(): number {
    return this.#cleanups.size;
  }

  addCleanup(cleanup: Cleanup): Disposable {
    this.#assertWritable();
    return this.#cleanups.add(cleanup);
  }

  recordProvided(key: ServiceKey<unknown>): void {
    this.#assertWritable();
    this.#provided.add(key.id);
  }

  hasProvided(key: ServiceKey<unknown>): boolean {
    return this.#provided.has(key.id);
  }

  activate(): void {
    if (this.#state !== 'initializing') {
      throw new ThrexusError(
        'SCOPE_STATE',
        `Feature "${this.feature.name}" cannot activate from ${this.#state}.`,
      );
    }
    this.#state = 'active';
  }

  abort(reason?: unknown): void {
    if (!this.#controller.signal.aborted) {
      this.#controller.abort(reason);
    }
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }

    if (this.#state === 'disposed') {
      return Promise.resolve();
    }

    this.#state = 'disposing';
    this.abort(
      new Error(`Feature "${this.feature.name}" is being disposed.`),
    );
    this.#disposePromise = this.#runDispose();
    return this.#disposePromise;
  }

  async #runDispose(): Promise<void> {
    try {
      await this.#cleanups.dispose();
      this.#state = 'disposed';
    } catch (error) {
      this.#state = 'failed';
      throw error;
    }
  }

  #assertWritable(): void {
    if (this.#state !== 'initializing' && this.#state !== 'active') {
      throw new ThrexusError(
        'SCOPE_STATE',
        `Feature "${this.feature.name}" cannot register resources while ${this.#state}.`,
      );
    }
  }
}
