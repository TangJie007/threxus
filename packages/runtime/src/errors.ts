/**
 * 运行时错误类型。
 *
 * 所有可识别的框架错误都使用 {@link ThrexusError}，并通过 {@link ThrexusErrorCode}
 * 区分错误类别，便于调用方和测试断言。
 *
 * 设计约定：
 * - 原始异常通过 `ErrorOptions.cause` 保留，不在消息中丢失上下文。
 * - 清理阶段允许多个错误并存，由 {@link AggregateError} 汇总。
 */

/** 运行时错误码，按模块/契约划分。 */
export type ThrexusErrorCode =
  | 'APP_STATE'
  | 'ASSET_LOAD'
  | 'ASSET_STATE'
  | 'CLEANUP_STATE'
  | 'DUPLICATE_FEATURE'
  | 'DUPLICATE_SERVICE'
  | 'FEATURE_DEPENDENCY_CYCLE'
  | 'FEATURE_SETUP'
  | 'MISSING_SERVICE'
  | 'PIPELINE_STATE'
  | 'GRAPHICS_RESTORE'
  | 'RELEASED_ASSET_HANDLE'
  | 'SCOPE_STATE'
  | 'SERVICE_CONTRACT'
  | 'UNKNOWN_LOADER';

/** 带错误码的运行时异常。 */
export class ThrexusError extends Error {
  readonly code: ThrexusErrorCode;

  constructor(
    code: ThrexusErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ThrexusError';
    this.code = code;
  }
}

/**
 * 将未知值规范化为 `Error`。
 * 用于 catch 分支和 AggregateError 汇总，避免非 Error 抛出物破坏清理流程。
 */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
