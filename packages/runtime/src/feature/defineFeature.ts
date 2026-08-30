/**
 * 定义 Feature，并保留调用方对象的精确类型。
 *
 * 该辅助函数不改变 FeatureGraph 或生命周期语义，仅统一定义入口，
 * 并把名称校验提前到定义阶段。
 */

import type { ThreeFeature } from './ThreeFeature';

export function defineFeature<TFeature extends ThreeFeature>(
  feature: TFeature,
): Readonly<TFeature> {
  if (!feature.name.trim()) {
    throw new TypeError('Feature name must be a non-empty string.');
  }

  return Object.freeze(feature);
}
