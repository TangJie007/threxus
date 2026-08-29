/**
 * 单个 Feature 的生命周期作用域。
 *
 * 每个成功进入 setup 的 Feature 对应一个 FeatureScope，负责：
 * - 持有 Feature 级 AbortController（dispose 时 abort signal）。
 * - 管理该 Feature 注册的 CleanupStack。
 * - 追踪 setup 期间实际 provide 的服务 Key（用于契约校验）。
 *
 * 状态机：
 * ```text
 * initializing → active → disposing → disposed
 *                    ↘ failed（dispose 清理失败）
 * ```
 *
 * initializing/active 可注册 cleanup 和 recordProvided；
 * disposing 后 signal 已 abort，禁止再写入。
 */

import { ThrexusError } from '../errors';
import { CleanupStack } from '../lifecycle/CleanupStack';
import type { Cleanup, Disposable } from '../lifecycle/Disposable';
import type { ServiceKey } from '../services/ServiceKey';
import type { ThreeFeature } from './ThreeFeature';

export type FeatureScopeState =
  | 'initializing'
  | 'active'
  | 'disposing'
  | 'disposed'
  | 'failed';

export class FeatureScope implements Disposable {
  readonly #controller = new AbortController();
  readonly #cleanups = new CleanupStack();
  /** setup 期间 ctx.provide 记录过的 Key，用于 verifyProvidedServices。 */
  readonly #provided = new Set<symbol>();
  #state: FeatureScopeState = 'initializing';
  #disposePromise: Promise<void> | undefined;

  constructor(readonly feature: ThreeFeature) {}

  get state(): FeatureScopeState {
    return this.#state;
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get cleanupCount(): number {
    return this.#cleanups.size;
  }

  addCleanup(cleanup: Cleanup): Disposable {
    this.#assertWritable();
    return this.#cleanups.add(cleanup);
  }

  /** 记录 Feature 已通过 provide 注册的服务。 */
  recordProvided(key: ServiceKey<unknown>): void {
    this.#assertWritable();
    this.#provided.add(key.id);
  }

  hasProvided(key: ServiceKey<unknown>): boolean {
    return this.#provided.has(key.id);
  }

  /** setup 成功后由 ThreeApp 调用，进入 active。 */
  activate(): void {
    if (this.#state !== 'initializing') {
      throw new ThrexusError(
        'SCOPE_STATE',
        `Feature "${this.feature.name}" cannot activate from ${this.#state}.`,
      );
    }
    this.#state = 'active';
  }

  /** 触发 abort，使 setup 中的 async 逻辑可协作退出。 */
  abort(reason?: unknown): void {
    if (!this.#controller.signal.aborted) {
      this.#controller.abort(reason);
    }
  }

  /** 销毁 Scope：abort signal → LIFO 清理 cleanup 栈。 */
  dispose(): Promise<void> {
    if (this.#disposePromise) {
      return this.#disposePromise;
    }

    if (this.#state === 'disposed') {
      return Promise.resolve();
    }

    this.#state = 'disposing';
    this.abort(
      new Error(`Feature "${this.feature.name}" is being disposed.`),
    );
    this.#disposePromise = this.#runDispose();
    return this.#disposePromise;
  }

  async #runDispose(): Promise<void> {
    try {
      await this.#cleanups.dispose();
      this.#state = 'disposed';
    } catch (error) {
      this.#state = 'failed';
      throw error;
    }
  }

  #assertWritable(): void {
    if (this.#state !== 'initializing' && this.#state !== 'active') {
      throw new ThrexusError(
        'SCOPE_STATE',
        `Feature "${this.feature.name}" cannot register resources while ${this.#state}.`,
      );
    }
  }
}
