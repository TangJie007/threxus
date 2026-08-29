/**
 * Feature 注册表。
 *
 * 在 App `start()` 之前收集 Feature；`start()` 时 lock 并交给
 * {@link resolveFeatureGraph} 解析安装顺序。
 *
 * 一旦 lock，禁止再 add，避免启动过程中图结构变化。
 */

import { ThrexusError } from '../errors';
import { resolveFeatureGraph, type ResolvedFeatureGraph } from './FeatureGraph';
import type { ThreeFeature } from './ThreeFeature';

export class FeatureRegistry {
  readonly #features: ThreeFeature[] = [];
  /** start 后为 true，禁止继续注册。 */
  #locked = false;

  /** 注册 Feature；名称重复或已 lock 时抛错。 */
  add(feature: ThreeFeature): void {
    if (this.#locked) {
      throw new ThrexusError(
        'APP_STATE',
        'Features cannot be registered after the application starts.',
      );
    }

    if (this.#features.some((candidate) => candidate.name === feature.name)) {
      throw new ThrexusError(
        'DUPLICATE_FEATURE',
        `Feature "${feature.name}" is already registered.`,
      );
    }

    this.#features.push(feature);
  }

  /**
   * 锁定注册表并解析依赖图。
   * 由 ThreeApp 在 start 流程开始时调用一次。
   */
  lockAndResolve(): ResolvedFeatureGraph {
    this.#locked = true;
    return resolveFeatureGraph(this.#features);
  }
}
