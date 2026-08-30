import {
  ThrexusError,
  type ThrexusErrorContext,
} from '../errors';

/** 为不可强制取消的用户生命周期 Promise 提供有上下文的超时边界。 */
export async function withLifecycleTimeout<T>(
  task: PromiseLike<T>,
  timeoutMs: number,
  label: string,
  context: ThrexusErrorContext,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return task;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new ThrexusError(
          'LIFECYCLE_TIMEOUT',
          `${label} did not finish within ${timeoutMs}ms.`,
          { context },
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(task), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
