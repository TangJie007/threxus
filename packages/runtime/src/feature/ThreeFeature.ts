import type { Cleanup, Disposable } from '../lifecycle/Disposable';
import type { ServiceKey } from '../services/ServiceKey';

export interface ProvideServiceOptions {
  readonly dispose?: 'auto' | 'manual';
}

export interface ThreeContext {
  readonly canvas: HTMLCanvasElement;
  readonly signal: AbortSignal;

  provide<T>(
    key: ServiceKey<T>,
    service: T,
    options?: ProvideServiceOptions,
  ): void;
  inject<T>(key: ServiceKey<T>): T;
  injectOptional<T>(key: ServiceKey<T>): T | undefined;
  addCleanup(cleanup: Cleanup): Disposable;
}

export interface ThreeFeature {
  readonly name: string;
  readonly provides?: readonly ServiceKey<unknown>[];
  readonly dependencies?: readonly ServiceKey<unknown>[];
  readonly optionalDependencies?: readonly ServiceKey<unknown>[];

  setup(context: ThreeContext): void | Promise<void>;
}
