/**
 * CacheEntry 状态机与等待者管理。
 */

import type { AssetKey } from './AssetKey';
import type { AssetLoader } from './AssetLoader';
import {
  ManagedAssetHandle,
  type AssetHandleHost,
} from './AssetHandle';

export type AssetEntryState =
  | 'loading'
  | 'ready'
  | 'release-pending'
  | 'disposing'
  | 'disposed'
  | 'failed';

export interface AssetWaiter<T> {
  readonly signal: AbortSignal;
  readonly resolve: (handle: ManagedAssetHandle<T>) => void;
  readonly reject: (error: unknown) => void;
}

export class AssetCacheEntry<T = unknown> {
  state: AssetEntryState = 'loading';
  refs = 0;
  asset: T | undefined;
  error: unknown;
  releaseTimer: ReturnType<typeof setTimeout> | undefined;
  loadController: AbortController | undefined;
  loadPromise: Promise<void> | undefined;
  failedAt: number | undefined;
  readonly waiters = new Set<AssetWaiter<T>>();

  constructor(
    readonly key: AssetKey,
    readonly loader: AssetLoader<T>,
  ) {}

  createHandle(host: AssetHandleHost): ManagedAssetHandle<T> {
    if (this.asset === undefined) {
      throw new Error(`Asset "${this.key.cacheKey}" has no value.`);
    }
    this.refs += 1;
    return new ManagedAssetHandle(this.asset, this.key, host);
  }

  clearReleaseTimer(): void {
    if (this.releaseTimer !== undefined) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = undefined;
    }
  }
}
