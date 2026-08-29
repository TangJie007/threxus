/**
 * AssetLoader 契约与加载上下文。
 */

import type { AssetKey } from './AssetKey';

export interface AssetLoadContext {
  readonly signal: AbortSignal;
  readonly key: AssetKey;
}

/**
 * 可注册的资产加载器。
 * `dispose` 在引用归零并完成延迟释放时由 AssetManager 调用。
 */
export interface AssetLoader<T = unknown, O = unknown> {
  readonly type: string;
  load(
    source: string,
    options: O | undefined,
    context: AssetLoadContext,
  ): Promise<T>;
  dispose?(asset: T): void;
}
