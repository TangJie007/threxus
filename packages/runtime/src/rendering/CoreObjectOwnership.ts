import type { Ownership } from './types';

/** 记录 Scene / Renderer / Camera 的所有权，决定 App dispose 是否释放。 */
export class CoreObjectOwnership {
  readonly #records = new Map<object, Ownership>();

  register<T extends object>(value: T, ownership: Ownership): T {
    this.#records.set(value, ownership);
    return value;
  }

  get(value: object): Ownership | undefined {
    return this.#records.get(value);
  }

  shouldDispose(value: object): boolean {
    return this.#records.get(value) === 'app';
  }

  clear(): void {
    this.#records.clear();
  }
}
