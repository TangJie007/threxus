/**
 * Feature 级 Context lost / restored 回调注册表。
 *
 * 恢复回调按 Feature 安装顺序执行；失败时携带 Feature 名称。
 */

import { remove } from 'es-toolkit';
import { ThrexusError } from '../errors';
import type { Disposable } from '../lifecycle/Disposable';

export type ContextLostCallback = () => void;
export type ContextRestoredCallback = () => void | Promise<void>;

interface LostRecord {
  readonly scopeId: string;
  readonly order: number;
  readonly callback: ContextLostCallback;
}

interface RestoredRecord {
  readonly scopeId: string;
  readonly order: number;
  readonly callback: ContextRestoredCallback;
}

export class ContextRestoreRegistry {
  readonly #lost: LostRecord[] = [];
  readonly #restored: RestoredRecord[] = [];
  #nextOrder = 0;

  onLost(scopeId: string, callback: ContextLostCallback): Disposable {
    const record: LostRecord = {
      scopeId,
      order: this.#nextOrder,
      callback,
    };
    this.#nextOrder += 1;
    this.#lost.push(record);
    return {
      dispose: () => {
        remove(
          this.#lost,
          (item) => item.order === record.order && item.scopeId === scopeId,
        );
      },
    };
  }

  onRestored(scopeId: string, callback: ContextRestoredCallback): Disposable {
    const record: RestoredRecord = {
      scopeId,
      order: this.#nextOrder,
      callback,
    };
    this.#nextOrder += 1;
    this.#restored.push(record);
    return {
      dispose: () => {
        remove(
          this.#restored,
          (item) => item.order === record.order && item.scopeId === scopeId,
        );
      },
    };
  }

  notifyLost(): void {
    const snapshot = [...this.#lost].sort((a, b) => a.order - b.order);
    for (const record of snapshot) {
      record.callback();
    }
  }

  /** 按注册顺序依次 await；任一失败抛出，附带 scopeId。 */
  async notifyRestored(): Promise<void> {
    const snapshot = [...this.#restored].sort((a, b) => a.order - b.order);
    for (const record of snapshot) {
      try {
        await record.callback();
      } catch (error) {
        const cause =
          error instanceof Error ? error : new Error(String(error));
        throw new ThrexusError(
          'GRAPHICS_RESTORE',
          `Context restore failed in feature "${record.scopeId}": ${cause.message}`,
          {
            cause,
            context: {
              feature: record.scopeId,
              operation: 'context-restore',
            },
          },
        );
      }
    }
  }

  clear(): void {
    this.#lost.length = 0;
    this.#restored.length = 0;
  }
}
