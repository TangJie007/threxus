/**
 * 诊断模块导出（M12）。
 */

export {
  createLogger,
  type CreateLoggerOptions,
  type LogLevel,
  type Logger,
} from './Logger';
export {
  inspectRuntime,
  type DiagnosticSnapshot,
  type RendererInfoSnapshot,
} from './RuntimeInspector';
export {
  shouldEnableLifecycleWarnings,
  warnLifecycle,
  type LifecycleWarningOptions,
} from './lifecycleWarnings';
