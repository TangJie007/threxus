import { ThrexusError } from '../errors';
import type { ServiceKey } from './ServiceKey';

interface ServiceEntry {
  readonly key: ServiceKey<unknown>;
  readonly owner: string;
  readonly value: unknown;
}

export class ServiceContainer {
  readonly #entries = new Map<symbol, ServiceEntry>();

  get size(): number {
    return this.#entries.size;
  }

  provide<T>(owner: string, key: ServiceKey<T>, value: T): void {
    const existing = this.#entries.get(key.id);
    if (existing) {
      throw new ThrexusError(
        'DUPLICATE_SERVICE',
        `Service "${key.description}" is already provided by feature "${existing.owner}".`,
      );
    }

    this.#entries.set(key.id, {
      key: key as ServiceKey<unknown>,
      owner,
      value,
    });
  }

  has(key: ServiceKey<unknown>): boolean {
    return this.#entries.has(key.id);
  }

  get<T>(key: ServiceKey<T>): T {
    const entry = this.#entries.get(key.id);
    if (!entry) {
      throw new ThrexusError(
        'MISSING_SERVICE',
        `Service "${key.description}" is not available.`,
      );
    }

    return entry.value as T;
  }

  getOptional<T>(key: ServiceKey<T>): T | undefined {
    return this.#entries.get(key.id)?.value as T | undefined;
  }

  remove(owner: string, key: ServiceKey<unknown>): void {
    const entry = this.#entries.get(key.id);
    if (entry?.owner === owner) {
      this.#entries.delete(key.id);
    }
  }

  removeOwner(owner: string): void {
    for (const [id, entry] of this.#entries) {
      if (entry.owner === owner) {
        this.#entries.delete(id);
      }
    }
  }

  clear(): void {
    this.#entries.clear();
  }
}
