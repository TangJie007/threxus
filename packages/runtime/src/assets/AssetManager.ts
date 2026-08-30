/**
 * AssetManager：共享资产加载、缓存、引用计数与延迟释放。
 *
 * CacheEntry 状态：
 * ```text
 * loading ──success──▶ ready
 * loading ──failure──▶ failed ──evict──▶ disposed
 * ready ──refs=0──▶ release-pending ──timeout──▶ disposing ──▶ disposed
 * release-pending ──acquire──▶ ready
 * ```
 */

import { isPlainObject } from 'es-toolkit';
import { ThrexusError, toError } from '../errors';
import type { Disposable } from '../lifecycle/Disposable';
import { isBindableAsset } from './AssetLifetime';
import {
  AssetCacheEntry,
  type AssetWaiter,
} from './AssetCacheEntry';
import {
  ManagedAssetPin,
  type AssetHandle,
  type AssetHandleHost,
  type AssetPin,
  type ManagedAssetHandle,
} from './AssetHandle';
import {
  normalizeAssetKey,
  type AssetKey,
  type NormalizeAssetKeyOptions,
} from './AssetKey';
import type { AssetLoader } from './AssetLoader';
import type { GltfAsset } from './gltf/GltfAsset';

export interface AssetManagerOptions extends NormalizeAssetKeyOptions {
  /** 引用归零后延迟释放毫秒数，默认 30_000。 */
  readonly releaseDelayMs?: number;
  /** 失败条目短暂退避，期间再次 acquire 直接失败；默认 0（立即允许重试）。 */
  readonly failureBackoffMs?: number;
}

export interface AcquireOptions {
  readonly signal?: AbortSignal;
  readonly variant?: string;
  readonly params?: unknown;
  /** 传给 Loader 的 options（不进入 cache key，除非同时放进 params）。 */
  readonly loaderOptions?: unknown;
}

export interface AssetManagerSnapshot {
  readonly disposed: boolean;
  readonly entries: number;
  readonly loading: number;
  readonly ready: number;
  readonly releasePending: number;
  readonly failed: number;
  readonly totalRefs: number;
}

export interface AssetManager extends Disposable {
  registerLoader(loader: AssetLoader): void;
  acquire<T = unknown>(
    type: string,
    source: string,
    options?: AcquireOptions,
  ): Promise<AssetHandle<T>>;
  acquireTexture(
    source: string,
    options?: AcquireOptions,
  ): Promise<AssetHandle<import('three').Texture>>;
  acquireCubeTexture(
    urls: readonly string[],
    options?: AcquireOptions,
  ): Promise<AssetHandle<import('three').CubeTexture>>;
  acquireGLTF(
    source: string,
    options?: AcquireOptions,
  ): Promise<AssetHandle<GltfAsset>>;
  /**
   * 加载 HDR（或其它等距柱状）环境贴图并经 PMREM 预卷积。
   * 需要 App `start()` 后（renderer 已绑定）再调用。
   */
  acquireEnvironmentMap(
    source: string,
    options?: AcquireOptions,
  ): Promise<AssetHandle<import('three').Texture>>;
  preload(
    type: string,
    source: string,
    options?: AcquireOptions,
  ): Promise<AssetPin>;
  inspect(): AssetManagerSnapshot;
}

const DEFAULT_RELEASE_DELAY_MS = 30_000;

export function createAssetManager(
  options: AssetManagerOptions = {},
): AssetManager {
  return new AssetManagerRuntime(options);
}

class AssetManagerRuntime implements AssetManager, AssetHandleHost {
  readonly #loaders = new Map<string, AssetLoader>();
  readonly #entries = new Map<string, AssetCacheEntry>();
  readonly #handles = new Set<ManagedAssetHandle<unknown>>();
  readonly #releaseDelayMs: number;
  readonly #failureBackoffMs: number;
  readonly #baseURI: string | undefined;
  #disposed = false;
  #disposePromise: Promise<void> | undefined;

  constructor(options: AssetManagerOptions) {
    this.#releaseDelayMs = options.releaseDelayMs ?? DEFAULT_RELEASE_DELAY_MS;
    this.#failureBackoffMs = options.failureBackoffMs ?? 0;
    this.#baseURI = options.baseURI;
  }

  registerLoader(loader: AssetLoader): void {
    this.#assertNotDisposed();
    if (!loader.type.trim()) {
      throw new TypeError('AssetLoader.type must be a non-empty string.');
    }
    this.#loaders.set(loader.type, loader);
  }

  acquire<T = unknown>(
    type: string,
    source: string,
    options: AcquireOptions = {},
  ): Promise<AssetHandle<T>> {
    if (this.#disposed) {
      return Promise.reject(
        new ThrexusError(
          'ASSET_STATE',
          'Cannot use AssetManager after it has been disposed.',
        ),
      );
    }

    if (options.signal?.aborted) {
      return Promise.reject(abortReason(options.signal));
    }

    const key = normalizeAssetKey(
      {
        type,
        source,
        ...(options.variant !== undefined ? { variant: options.variant } : {}),
        ...(options.params !== undefined ? { params: options.params } : {}),
      },
      this.#baseURI !== undefined ? { baseURI: this.#baseURI } : {},
    );

    const loader = this.#loaders.get(type) as AssetLoader<T> | undefined;
    if (!loader) {
      return Promise.reject(
        new ThrexusError(
          'UNKNOWN_LOADER',
          `No AssetLoader registered for type "${type}".`,
        ),
      );
    }

    return this.#acquireWithKey(key, loader, options);
  }

  acquireTexture(
    source: string,
    options: AcquireOptions = {},
  ): Promise<AssetHandle<import('three').Texture>> {
    return this.acquire('texture', source, options);
  }

  acquireCubeTexture(
    urls: readonly string[],
    options: AcquireOptions = {},
  ): Promise<AssetHandle<import('three').CubeTexture>> {
    if (urls.length !== 6) {
      return Promise.reject(
        new TypeError('acquireCubeTexture requires exactly 6 URLs.'),
      );
    }

    const absolute = urls.map((url) =>
      normalizeAssetKey(
        { type: 'cube-texture', source: url },
        this.#baseURI !== undefined ? { baseURI: this.#baseURI } : {},
      ).source,
    );

    return this.acquire('cube-texture', absolute[0]!, {
      ...options,
      params: {
        urls: absolute,
        ...(isPlainObject(options.params) ? options.params : {}),
      },
      loaderOptions: {
        urls: absolute,
        ...(isPlainObject(options.loaderOptions) ? options.loaderOptions : {}),
      },
    });
  }

  acquireGLTF(
    source: string,
    options: AcquireOptions = {},
  ): Promise<AssetHandle<GltfAsset>> {
    return this.acquire('gltf', source, options);
  }

  acquireEnvironmentMap(
    source: string,
    options: AcquireOptions = {},
  ): Promise<AssetHandle<import('three').Texture>> {
    return this.acquire('environment-map', source, options);
  }

  async preload(
    type: string,
    source: string,
    options: AcquireOptions = {},
  ): Promise<AssetPin> {
    const handle = await this.acquire(type, source, options);
    return new ManagedAssetPin(handle as AssetHandle<unknown>);
  }

  releaseHandle(handle: ManagedAssetHandle<unknown>): void {
    this.#handles.delete(handle);

    if (this.#disposed) {
      return;
    }

    const entry = this.#entries.get(handle.key.cacheKey);
    if (!entry) {
      return;
    }

    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0 && entry.state === 'ready') {
      this.#scheduleRelease(entry);
    }
  }

  inspect(): AssetManagerSnapshot {
    let loading = 0;
    let ready = 0;
    let releasePending = 0;
    let failed = 0;
    let totalRefs = 0;

    for (const entry of this.#entries.values()) {
      totalRefs += entry.refs;
      switch (entry.state) {
        case 'loading':
          loading += 1;
          break;
        case 'ready':
          ready += 1;
          break;
        case 'release-pending':
          releasePending += 1;
          break;
        case 'failed':
          failed += 1;
          break;
        default:
          break;
      }
    }

    return {
      disposed: this.#disposed,
      entries: this.#entries.size,
      loading,
      ready,
      releasePending,
      failed,
      totalRefs,
    };
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }
    if (this.#disposed) {
      return Promise.resolve();
    }

    this.#disposed = true;
    this.#disposePromise = this.#runDispose();
    return this.#disposePromise;
  }

  async #acquireWithKey<T>(
    key: AssetKey,
    loader: AssetLoader<T>,
    options: AcquireOptions,
  ): Promise<AssetHandle<T>> {
    const existing = this.#entries.get(key.cacheKey) as
      | AssetCacheEntry<T>
      | undefined;

    if (existing) {
      if (existing.state === 'ready' && existing.asset !== undefined) {
        existing.clearReleaseTimer();
        return this.#trackHandle(existing.createHandle(this));
      }

      if (existing.state === 'release-pending' && existing.asset !== undefined) {
        existing.clearReleaseTimer();
        existing.state = 'ready';
        return this.#trackHandle(existing.createHandle(this));
      }

      if (existing.state === 'loading') {
        return this.#waitForLoading(existing, options.signal);
      }

      if (existing.state === 'failed') {
        const backoff = this.#failureBackoffMs;
        if (
          backoff > 0 &&
          existing.failedAt !== undefined &&
          Date.now() - existing.failedAt < backoff
        ) {
          return Promise.reject(
            existing.error instanceof Error
              ? existing.error
              : new ThrexusError(
                  'ASSET_LOAD',
                  `Asset "${key.source}" recently failed to load.`,
                  { cause: existing.error },
                ),
          );
        }
        this.#entries.delete(key.cacheKey);
      }
    }

    const entry = new AssetCacheEntry<T>(key, loader);
    this.#entries.set(key.cacheKey, entry as AssetCacheEntry);
    this.#startLoad(entry, options.loaderOptions);

    return this.#waitForLoading(entry, options.signal);
  }

  #startLoad<T>(entry: AssetCacheEntry<T>, loaderOptions: unknown): void {
    const controller = new AbortController();
    entry.loadController = controller;
    entry.state = 'loading';

    entry.loadPromise = (async () => {
      try {
        const asset = await entry.loader.load(
          entry.key.source,
          loaderOptions as never,
          { signal: controller.signal, key: entry.key },
        );

        if (this.#disposed || controller.signal.aborted) {
          entry.loader.dispose?.(asset);
          entry.state = 'disposed';
          this.#entries.delete(entry.key.cacheKey);
          this.#rejectWaiters(entry, abortReason(controller.signal));
          return;
        }

        entry.asset = asset;
        entry.state = 'ready';
        this.#bindAssetLifetime(entry);

        const waiters = [...entry.waiters];
        entry.waiters.clear();

        if (waiters.length === 0) {
          // 全部等待者已 abort：立即进入释放
          this.#scheduleRelease(entry, 0);
          return;
        }

        for (const waiter of waiters) {
          if (waiter.signal.aborted) {
            continue;
          }
          try {
            waiter.resolve(this.#trackHandle(entry.createHandle(this)));
          } catch (error) {
            waiter.reject(error);
          }
        }

        // 若所有 waiter 都已 abort，refs 仍为 0
        if (entry.refs === 0) {
          this.#scheduleRelease(entry, 0);
        }
      } catch (error) {
        if (this.#disposed) {
          entry.state = 'disposed';
          this.#entries.delete(entry.key.cacheKey);
          this.#rejectWaiters(entry, error);
          return;
        }

        entry.error = error;
        entry.failedAt = Date.now();
        entry.state = 'failed';
        this.#rejectWaiters(entry, error);

        if (this.#failureBackoffMs <= 0) {
          this.#entries.delete(entry.key.cacheKey);
        }
      } finally {
        entry.loadController = undefined;
      }
    })();
  }

  #waitForLoading<T>(
    entry: AssetCacheEntry<T>,
    signal: AbortSignal | undefined,
  ): Promise<AssetHandle<T>> {
    return new Promise<AssetHandle<T>>((resolve, reject) => {
      const waiter: AssetWaiter<T> = {
        signal: signal ?? new AbortController().signal,
        resolve: (handle) => resolve(handle),
        reject,
      };

      const onAbort = (): void => {
        entry.waiters.delete(waiter);
        reject(abortReason(waiter.signal));

        if (
          entry.state === 'loading' &&
          entry.waiters.size === 0 &&
          entry.loadController &&
          !entry.loadController.signal.aborted
        ) {
          entry.loadController.abort(
            new ThrexusError(
              'ASSET_LOAD',
              `All waiters aborted for asset "${entry.key.source}".`,
            ),
          );
        }
      };

      if (waiter.signal.aborted) {
        onAbort();
        return;
      }

      entry.waiters.add(waiter);
      waiter.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  #scheduleRelease<T>(
    entry: AssetCacheEntry<T>,
    delay = this.#releaseDelayMs,
  ): void {
    if (entry.state === 'disposing' || entry.state === 'disposed') {
      return;
    }

    entry.clearReleaseTimer();
    entry.state = 'release-pending';

    if (delay <= 0) {
      void this.#disposeEntry(entry);
      return;
    }

    entry.releaseTimer = setTimeout(() => {
      entry.releaseTimer = undefined;
      if (entry.refs === 0 && entry.state === 'release-pending') {
        void this.#disposeEntry(entry);
      }
    }, delay);
  }

  async #disposeEntry<T>(entry: AssetCacheEntry<T>): Promise<void> {
    if (entry.refs > 0) {
      entry.state = 'ready';
      return;
    }

    entry.state = 'disposing';
    entry.clearReleaseTimer();

    try {
      if (entry.asset !== undefined) {
        entry.loader.dispose?.(entry.asset);
      }
    } finally {
      entry.asset = undefined;
      entry.state = 'disposed';
      this.#entries.delete(entry.key.cacheKey);
    }
  }

  #rejectWaiters<T>(entry: AssetCacheEntry<T>, reason: unknown): void {
    const waiters = [...entry.waiters];
    entry.waiters.clear();
    for (const waiter of waiters) {
      waiter.reject(reason);
    }
  }

  async #runDispose(): Promise<void> {
    const errors: Error[] = [];

    for (const handle of this.#handles) {
      handle.invalidate();
    }
    this.#handles.clear();

    for (const entry of [...this.#entries.values()]) {
      entry.clearReleaseTimer();
      entry.loadController?.abort(
        new ThrexusError('ASSET_STATE', 'AssetManager is disposing.'),
      );

      for (const waiter of [...entry.waiters]) {
        waiter.reject(
          new ThrexusError('ASSET_STATE', 'AssetManager is disposing.'),
        );
      }
      entry.waiters.clear();

      if (entry.loadPromise) {
        try {
          await entry.loadPromise;
        } catch {
          // 加载错误在 acquire 侧处理
        }
      }

      if (entry.asset !== undefined) {
        try {
          entry.loader.dispose?.(entry.asset);
        } catch (error) {
          errors.push(toError(error));
        }
      }

      entry.asset = undefined;
      entry.state = 'disposed';
      entry.refs = 0;
    }

    this.#entries.clear();

    if (errors.length > 0) {
      throw new AggregateError(errors, 'AssetManager disposal failed.');
    }
  }

  #bindAssetLifetime<T>(entry: AssetCacheEntry<T>): void {
    if (!isBindableAsset(entry.asset)) {
      return;
    }

    entry.asset.bindLifetime({
      retain: () => {
        if (this.#disposed) {
          return;
        }
        entry.refs += 1;
        entry.clearReleaseTimer();
        if (entry.state === 'release-pending') {
          entry.state = 'ready';
        }
      },
      release: () => {
        if (this.#disposed) {
          return;
        }
        entry.refs = Math.max(0, entry.refs - 1);
        if (entry.refs === 0 && entry.state === 'ready') {
          this.#scheduleRelease(entry);
        }
      },
    });
  }

  #trackHandle<T>(handle: ManagedAssetHandle<T>): ManagedAssetHandle<T> {
    this.#handles.add(handle as ManagedAssetHandle<unknown>);
    return handle;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new ThrexusError(
        'ASSET_STATE',
        'Cannot use AssetManager after it has been disposed.',
      );
    }
  }
}

function abortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new ThrexusError('ASSET_LOAD', 'Asset acquire was aborted.')
  );
}
