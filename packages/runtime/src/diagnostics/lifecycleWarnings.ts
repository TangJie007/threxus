/**
 * 开发模式生命周期警告（不改变行为，仅诊断）。
 */

import type { Logger } from './Logger';

export interface LifecycleWarningOptions {
  readonly enabled?: boolean;
  readonly logger?: Logger;
}

export function shouldEnableLifecycleWarnings(
  enabled: boolean | undefined,
): boolean {
  if (enabled !== undefined) {
    return enabled;
  }
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.['NODE_ENV'];
  return env !== 'production';
}

export function warnLifecycle(
  logger: Logger | undefined,
  message: string,
): void {
  logger?.warn(message);
}
