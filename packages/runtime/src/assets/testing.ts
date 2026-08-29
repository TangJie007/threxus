/**
 * 测试用可控假 Loader：验证并发合并与状态机。
 */

import type { AssetLoader, AssetLoadContext } from './AssetLoader';

export interface DeferredTestLoader<T> extends AssetLoader<T, unknown> {
  readonly calls: number;
  readonly pending: number;
  resolve(asset: T): void;
  reject(error: unknown): void;
}

export function createDeferredTestLoader<T>(
  type = 'test',
): DeferredTestLoader<T> {
  let calls = 0;
  const pending = new Map<
    AssetLoadContext,
    {
      resolve: (value: T) => void;
      reject: (error: unknown) => void;
    }
  >();

  const loader: DeferredTestLoader<T> = {
    type,
    get calls() {
      return calls;
    },
    get pending() {
      return pending.size;
    },
    load(_source, _options, context) {
      calls += 1;
      return new Promise<T>((resolve, reject) => {
        if (context.signal.aborted) {
          reject(context.signal.reason);
          return;
        }

        const entry = { resolve, reject };
        pending.set(context, entry);

        const onAbort = (): void => {
          pending.delete(context);
          reject(context.signal.reason);
        };
        context.signal.addEventListener('abort', onAbort, { once: true });
      });
    },
    dispose() {
      // no-op for tests unless overridden
    },
    resolve(asset) {
      const entries = [...pending.values()];
      pending.clear();
      for (const entry of entries) {
        entry.resolve(asset);
      }
    },
    reject(error) {
      const entries = [...pending.values()];
      pending.clear();
      for (const entry of entries) {
        entry.reject(error);
      }
    },
  };

  return loader;
}
