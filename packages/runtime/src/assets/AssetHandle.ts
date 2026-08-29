/**
 * AssetHandle：每次成功 acquire 返回的独立引用句柄。
 */

import type { Disposable } from '../lifecycle/Disposable';
import type { AssetKey } from './AssetKey';
import { ReleasedAssetHandleError } from './AssetErrors';

export type AssetHandleState = 'active' | 'released';

export interface AssetHandle<T> extends Disposable {
  readonly value: T;
  readonly key: AssetKey;
  readonly released: boolean;
  readonly state: AssetHandleState;
}

export interface AssetHandleHost {
  releaseHandle(handle: ManagedAssetHandle<unknown>): void;
}

export class ManagedAssetHandle<T> implements AssetHandle<T> {
  #state: AssetHandleState = 'active';
  readonly #asset: T;
  readonly #key: AssetKey;
  readonly #host: AssetHandleHost;

  constructor(asset: T, key: AssetKey, host: AssetHandleHost) {
    this.#asset = asset;
    this.#key = key;
    this.#host = host;
  }

  get key(): AssetKey {
    return this.#key;
  }

  get state(): AssetHandleState {
    return this.#state;
  }

  get released(): boolean {
    return this.#state === 'released';
  }

  get value(): T {
    if (this.#state === 'released') {
      throw new ReleasedAssetHandleError();
    }
    return this.#asset;
  }

  dispose(): void {
    if (this.#state === 'released') {
      return;
    }

    this.#state = 'released';
    this.#host.releaseHandle(this as ManagedAssetHandle<unknown>);
  }

  /** App dispose 时强制失效，不再回调 host（由 Manager 统一清引用）。 */
  invalidate(): void {
    this.#state = 'released';
  }
}

/** Pin：预加载引用，不暴露业务 value。 */
export interface AssetPin extends Disposable {
  readonly key: AssetKey;
  readonly released: boolean;
}

export class ManagedAssetPin implements AssetPin {
  #released = false;
  readonly #handle: AssetHandle<unknown>;

  constructor(handle: AssetHandle<unknown>) {
    this.#handle = handle;
  }

  get key(): AssetKey {
    return this.#handle.key;
  }

  get released(): boolean {
    return this.#released || this.#handle.released;
  }

  dispose(): void {
    if (this.#released) {
      return;
    }
    this.#released = true;
    this.#handle.dispose();
  }
}
