import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ReleasedAssetHandleError,
  ThrexusError,
  createAssetManager,
  createDeferredTestLoader,
  normalizeAssetKey,
  stableSerialize,
} from '../../src';

describe('stableSerialize / AssetKey', () => {
  it('serializes object keys in sorted order', () => {
    expect(stableSerialize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('normalizes relative sources against baseURI', () => {
    const key = normalizeAssetKey(
      { type: 'texture', source: 'floor.webp' },
      { baseURI: 'https://cdn.example/assets/' },
    );
    expect(key.source).toBe('https://cdn.example/assets/floor.webp');
    expect(key.cacheKey).toContain('texture');
  });
});

describe('AssetManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges concurrent acquires into one loader call', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = createDeferredTestLoader<{ id: number }>('test');
    assets.registerLoader(loader);

    const first = assets.acquire('test', '/a');
    const second = assets.acquire('test', '/a');

    expect(loader.calls).toBe(1);

    loader.resolve({ id: 1 });

    const [a, b] = await Promise.all([first, second]);
    expect(a.value).toBe(b.value);
    expect(assets.inspect().totalRefs).toBe(2);

    a.dispose();
    b.dispose();
    await flushMicrotasks();
    expect(assets.inspect().entries).toBe(0);

    await assets.dispose();
  });

  it('aborts only the aborted waiter', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = createDeferredTestLoader<string>('test');
    assets.registerLoader(loader);

    const controller = new AbortController();
    const first = assets.acquire('test', '/a', { signal: controller.signal });
    const second = assets.acquire('test', '/a');

    controller.abort(new Error('cancel-first'));

    await expect(first).rejects.toThrow('cancel-first');

    loader.resolve('shared');
    const handle = await second;
    expect(handle.value).toBe('shared');
    expect(assets.inspect().totalRefs).toBe(1);

    handle.dispose();
    await assets.dispose();
  });

  it('cancels underlying load when all waiters abort', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = createDeferredTestLoader<string>('test');
    assets.registerLoader(loader);

    const c1 = new AbortController();
    const c2 = new AbortController();
    const first = assets.acquire('test', '/a', { signal: c1.signal });
    const second = assets.acquire('test', '/a', { signal: c2.signal });

    c1.abort();
    c2.abort();

    await expect(first).rejects.toBeTruthy();
    await expect(second).rejects.toBeTruthy();
    expect(loader.pending).toBe(0);

    await assets.dispose();
  });

  it('reactivates release-pending entry on re-acquire', async () => {
    vi.useFakeTimers();
    const assets = createAssetManager({ releaseDelayMs: 1_000 });
    const loader = createDeferredTestLoader<{ n: number }>('test');
    let disposed = 0;
    loader.dispose = () => {
      disposed += 1;
    };
    assets.registerLoader(loader);

    const firstPromise = assets.acquire('test', '/a');
    loader.resolve({ n: 1 });
    const first = await firstPromise;
    const asset = first.value;
    first.dispose();

    expect(assets.inspect().releasePending).toBe(1);

    const second = await assets.acquire('test', '/a');
    expect(second.value).toBe(asset);
    expect(disposed).toBe(0);
    expect(assets.inspect().ready).toBe(1);

    second.dispose();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(disposed).toBe(1);

    await assets.dispose();
  });

  it('allows retry after failure eviction', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = createDeferredTestLoader<string>('test');
    assets.registerLoader(loader);

    const failing = assets.acquire('test', '/a');
    loader.reject(new Error('boom'));
    await expect(failing).rejects.toThrow('boom');
    expect(assets.inspect().entries).toBe(0);

    const retry = assets.acquire('test', '/a');
    expect(loader.calls).toBe(2);
    loader.resolve('ok');
    const handle = await retry;
    expect(handle.value).toBe('ok');

    handle.dispose();
    await assets.dispose();
  });

  it('makes handle.dispose idempotent and blocks released value access', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = createDeferredTestLoader<string>('test');
    assets.registerLoader(loader);

    const pending = assets.acquire('test', '/a');
    loader.resolve('x');
    const handle = await pending;

    handle.dispose();
    handle.dispose();
    expect(() => handle.value).toThrow(ReleasedAssetHandleError);

    await assets.dispose();
  });

  it('preload returns a pin without exposing value', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = createDeferredTestLoader<string>('test');
    assets.registerLoader(loader);

    const pending = assets.preload('test', '/a');
    loader.resolve('pinned');
    const pin = await pending;

    expect(pin.key.type).toBe('test');
    expect(assets.inspect().totalRefs).toBe(1);
    pin.dispose();
    await flushMicrotasks();
    expect(assets.inspect().entries).toBe(0);

    await assets.dispose();
  });

  it('rejects acquire after dispose', async () => {
    const assets = createAssetManager();
    await assets.dispose();
    await expect(assets.acquire('test', '/a')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ThrexusError && error.code === 'ASSET_STATE',
    );
  });

  it('unknown loader type fails fast', async () => {
    const assets = createAssetManager({ registerDefaultLoaders: undefined });
    await expect(assets.acquire('missing', '/a')).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ThrexusError && error.code === 'UNKNOWN_LOADER',
    );
    await assets.dispose();
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
