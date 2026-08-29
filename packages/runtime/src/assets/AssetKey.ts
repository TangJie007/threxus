/**
 * AssetKey：缓存键规范化。
 *
 * 包含 loader type、绝对 URL、variant、稳定序列化后的 params。
 * 不含 AbortSignal / 进度回调等不影响结果的调用方元数据。
 */

import { stableSerialize } from './StableAssetKeySerializer';

export interface AssetKeyParts {
  readonly type: string;
  readonly source: string;
  readonly variant?: string;
  readonly params?: unknown;
}

export interface AssetKey {
  readonly type: string;
  /** 基于 baseURI 解析后的绝对 URL（或规范化 source）。 */
  readonly source: string;
  readonly variant: string | undefined;
  /** 稳定序列化后的 params；无参数时为空字符串。 */
  readonly paramsKey: string;
  /** Map 查找用的完整缓存键。 */
  readonly cacheKey: string;
}

export interface NormalizeAssetKeyOptions {
  /** 解析相对路径的基准；默认 document.baseURI 或 file:///。 */
  readonly baseURI?: string;
}

export function normalizeAssetKey(
  parts: AssetKeyParts,
  options: NormalizeAssetKeyOptions = {},
): AssetKey {
  if (!parts.type.trim()) {
    throw new TypeError('AssetKey.type must be a non-empty string.');
  }
  if (!parts.source.trim()) {
    throw new TypeError('AssetKey.source must be a non-empty string.');
  }

  const source = resolveAssetSource(parts.source, options.baseURI);
  const variant = parts.variant;
  const paramsKey =
    parts.params === undefined ? '' : stableSerialize(parts.params);

  const cacheKey = [
    parts.type,
    source,
    variant ?? '',
    paramsKey,
  ].join('\0');

  return {
    type: parts.type,
    source,
    variant,
    paramsKey,
    cacheKey,
  };
}

export function resolveAssetSource(source: string, baseURI?: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return source;
  }

  const base =
    baseURI ??
    (typeof document !== 'undefined' && document.baseURI
      ? document.baseURI
      : 'file:///');

  try {
    return new URL(source, base).href;
  } catch {
    return source;
  }
}
