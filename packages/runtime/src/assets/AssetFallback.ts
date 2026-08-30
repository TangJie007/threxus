/**
 * 资产降级编排：库负责失败切换、取消传播与结果标记，
 * 业务负责提供主资源和具体 fallback 内容。
 */

export type AssetFallbackSource = 'primary' | 'fallback';

export type AssetFallbackResult<T> =
  | {
      readonly value: T;
      readonly source: 'primary';
    }
  | {
      readonly value: T;
      readonly source: 'fallback';
      readonly primaryError: unknown;
    };

export interface AcquireWithFallbackOptions<T> {
  /** 主资源加载，例如 acquireGLTF / acquireTexture。 */
  readonly primary: (signal: AbortSignal | undefined) => T | Promise<T>;
  /** 主资源失败后的业务兜底工厂。 */
  readonly fallback: (
    primaryError: unknown,
    signal: AbortSignal | undefined,
  ) => T | Promise<T>;
  /** Feature / 调用方的取消信号；取消不会触发 fallback。 */
  readonly signal?: AbortSignal;
  /** 发生降级时的观测钩子（日志、遥测等）。 */
  readonly onFallback?: (primaryError: unknown) => void;
}

/**
 * 执行“主资源 → 失败后 fallback”策略。
 *
 * 本函数只编排策略，不接管返回值所有权。若回调返回 AssetHandle，
 * 仍应由调用方 `context.mount/retain` 或手动 dispose。
 */
export async function acquireWithFallback<T>(
  options: AcquireWithFallbackOptions<T>,
): Promise<AssetFallbackResult<T>> {
  throwIfAborted(options.signal);

  try {
    const value = await options.primary(options.signal);
    throwIfAborted(options.signal);
    return { value, source: 'primary' };
  } catch (primaryError) {
    // 用户取消与真正的资源失败语义不同，不能偷偷生成 fallback。
    throwIfAborted(options.signal);

    options.onFallback?.(primaryError);
    const value = await options.fallback(primaryError, options.signal);
    throwIfAborted(options.signal);
    return { value, source: 'fallback', primaryError };
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw (
    signal.reason ??
    new DOMException('Asset fallback operation was aborted.', 'AbortError')
  );
}
