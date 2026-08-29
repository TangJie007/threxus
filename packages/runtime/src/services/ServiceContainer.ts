/**
 * 应用级服务容器。
 *
 * M0–M3 阶段只有 App 级可见性：所有 Feature 共享同一容器，
 * 但每个服务条目记录 `owner`（提供它的 Feature 名称），便于销毁时批量移除。
 *
 * 规则：
 * - 同一 ServiceKey 只能有一个提供者。
 * - `get()` 缺失时抛错；`getOptional()` 返回 undefined。
 * - Feature 销毁时通过 `removeOwner()` 移除其全部服务。
 */

import { ThrexusError } from '../errors';
import type { ServiceKey } from './ServiceKey';

interface ServiceEntry {
  readonly key: ServiceKey<unknown>;
  /** 提供该服务的 Feature 名称。 */
  readonly owner: string;
  readonly value: unknown;
}

export class ServiceContainer {
  readonly #entries = new Map<symbol, ServiceEntry>();

  get size(): number {
    return this.#entries.size;
  }

  /** 注册服务；重复 Key 立即报错。 */
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

  /** 获取必需服务；不存在时抛 MISSING_SERVICE。 */
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

  /** 获取可选服务；不存在时返回 undefined，不抛错。 */
  getOptional<T>(key: ServiceKey<T>): T | undefined {
    return this.#entries.get(key.id)?.value as T | undefined;
  }

  /** 移除指定 Feature 拥有的单个服务（通常由 cleanup 回调调用）。 */
  remove(owner: string, key: ServiceKey<unknown>): void {
    const entry = this.#entries.get(key.id);
    if (entry?.owner === owner) {
      this.#entries.delete(key.id);
    }
  }

  /** Feature 销毁时移除其提供的全部服务。 */
  removeOwner(owner: string): void {
    for (const [id, entry] of this.#entries) {
      if (entry.owner === owner) {
        this.#entries.delete(id);
      }
    }
  }

  /** App 完全销毁时清空容器。 */
  clear(): void {
    this.#entries.clear();
  }
}
