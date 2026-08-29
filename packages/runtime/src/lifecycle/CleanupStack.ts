/**
 * 后进先出（LIFO）清理栈。
 *
 * Feature 和 App 在 setup 期间注册的资源（回调、监听器、服务释放等）
 * 都通过此栈统一管理，销毁时按注册顺序的**反方向**执行。
 *
 * 状态机：
 * ```text
 * open → disposing → disposed
 * ```
 *
 * 关键契约：
 * - `dispose()` 幂等，并发调用返回同一 Promise。
 * - 单个清理项失败不会阻止其余项执行，最终抛出 AggregateError。
 * - disposing/disposed 后禁止再 `add()`。
 * - 单个 entry 可通过返回的 Disposable 提前释放。
 */

import { sumBy } from 'es-toolkit';
import { ThrexusError, toError } from '../errors';
import {
  isDisposable,
  type Cleanup,
  type Disposable,
} from './Disposable';

export type CleanupStackState = 'open' | 'disposing' | 'disposed';

interface CleanupEntry {
  /** 是否仍待执行；提前 dispose 或栈 dispose 后置为 false。 */
  active: boolean;
  cleanup: Cleanup;
}

export class CleanupStack implements Disposable {
  #entries: CleanupEntry[] = [];
  #state: CleanupStackState = 'open';
  #disposePromise: Promise<void> | undefined;

  get state(): CleanupStackState {
    return this.#state;
  }

  /** 当前仍有效的清理项数量（不含已提前释放的 entry）。 */
  get size(): number {
    return sumBy(this.#entries, (entry) => Number(entry.active));
  }

  /**
   * 注册一个清理项。
   * @returns 可用于提前执行并移除该 entry 的 Disposable。
   */
  add(cleanup: Cleanup): Disposable {
    if (this.#state !== 'open') {
      throw new ThrexusError(
        'CLEANUP_STATE',
        `Cannot add cleanup while stack is ${this.#state}.`,
      );
    }

    const entry: CleanupEntry = { active: true, cleanup };
    this.#entries.push(entry);

    return {
      dispose: async () => {
        if (!entry.active) {
          return;
        }

        entry.active = false;
        await runCleanup(entry.cleanup);
      },
    };
  }

  /** 按 LIFO 顺序执行全部有效清理项。 */
  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }

    this.#state = 'disposing';
    this.#disposePromise = this.#disposeAll();
    return this.#disposePromise;
  }

  async #disposeAll(): Promise<void> {
    const errors: Error[] = [];

    // 从栈顶向栈底遍历，保证后注册的先清理。
    for (let index = this.#entries.length - 1; index >= 0; index -= 1) {
      const entry = this.#entries[index];
      if (!entry?.active) {
        continue;
      }

      entry.active = false;

      try {
        await runCleanup(entry.cleanup);
      } catch (error) {
        errors.push(toError(error));
      }
    }

    this.#entries = [];
    this.#state = 'disposed';

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more cleanup operations failed.');
    }
  }
}

/** 统一执行 Cleanup：函数直接调用，Disposable 走 dispose()。 */
async function runCleanup(cleanup: Cleanup): Promise<void> {
  if (isDisposable(cleanup)) {
    await cleanup.dispose();
    return;
  }

  await cleanup();
}
