import { ThrexusError, toError } from '../errors';
import {
  isDisposable,
  type Cleanup,
  type Disposable,
} from './Disposable';

export type CleanupStackState = 'open' | 'disposing' | 'disposed';

interface CleanupEntry {
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

  get size(): number {
    return this.#entries.reduce(
      (count, entry) => count + Number(entry.active),
      0,
    );
  }

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

async function runCleanup(cleanup: Cleanup): Promise<void> {
  if (isDisposable(cleanup)) {
    await cleanup.dispose();
    return;
  }

  await cleanup();
}
