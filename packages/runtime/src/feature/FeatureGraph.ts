/**
 * Feature 依赖图解析与稳定拓扑排序。
 *
 * 将 Feature 列表解析为可安全安装的顺序：
 * 1. 校验名称唯一、服务提供者唯一、必需依赖存在。
 * 2. 根据 provides → dependencies 构建有向边（provider → consumer）。
 * 3. Kahn 算法拓扑排序；同层节点按**原始注册索引**升序，保证顺序稳定可预测。
 * 4. 若存在环，通过 DFS 提取环路径用于错误报告。
 *
 * 边方向：若 Feature B 依赖 A 提供的服务，则边 A → B，
 * 因此 A 的 indegree 为 0 时先安装。
 */

import { range } from 'es-toolkit';
import { ThrexusError } from '../errors';
import type { ServiceKey } from '../services/ServiceKey';
import type { ThreeFeature } from './ThreeFeature';

/** 服务提供者记录，用于建图和重复检测。 */
interface ProviderRecord {
  readonly featureIndex: number;
  readonly featureName: string;
  readonly key: ServiceKey<unknown>;
}

/** 解析结果：按安装顺序排列的 Feature 列表。 */
export interface ResolvedFeatureGraph {
  readonly ordered: readonly ThreeFeature[];
}

/**
 * 解析 Feature 依赖图并返回拓扑序。
 * @throws {ThrexusError} DUPLICATE_FEATURE | DUPLICATE_SERVICE | MISSING_SERVICE |
 *   SERVICE_CONTRACT | FEATURE_DEPENDENCY_CYCLE
 */
export function resolveFeatureGraph(
  features: readonly ThreeFeature[],
): ResolvedFeatureGraph {
  const names = new Map<string, number>();
  const providers = new Map<symbol, ProviderRecord>();

  // 第一遍：校验 Feature 名称，建立 serviceKey → provider 映射。
  features.forEach((feature, featureIndex) => {
    const name = feature.name.trim();
    if (name.length === 0) {
      throw new ThrexusError(
        'DUPLICATE_FEATURE',
        'Feature name cannot be empty.',
      );
    }

    const previousIndex = names.get(name);
    if (previousIndex !== undefined) {
      throw new ThrexusError(
        'DUPLICATE_FEATURE',
        `Feature "${name}" is registered more than once at indexes ${previousIndex} and ${featureIndex}.`,
      );
    }
    names.set(name, featureIndex);

    for (const key of feature.provides ?? []) {
      const previous = providers.get(key.id);
      if (previous) {
        throw new ThrexusError(
          'DUPLICATE_SERVICE',
          `Service "${key.description}" is declared by both "${previous.featureName}" and "${name}".`,
        );
      }
      providers.set(key.id, { featureIndex, featureName: name, key });
    }
  });

  const outgoing = range(features.length).map(() => new Set<number>());
  const indegree = range(features.length).map(() => 0);

  // 第二遍：根据依赖关系建边 providerIndex → consumerIndex。
  features.forEach((feature, consumerIndex) => {
    const required = new Set(feature.dependencies?.map((key) => key.id) ?? []);

    // 同一 Key 不能同时出现在 required 与 optional 中。
    for (const key of feature.optionalDependencies ?? []) {
      if (required.has(key.id)) {
        throw new ThrexusError(
          'SERVICE_CONTRACT',
          `Feature "${feature.name}" declares "${key.description}" as both required and optional.`,
        );
      }
    }

    const dependencies = [
      ...(feature.dependencies ?? []).map((key) => ({
        key,
        required: true,
      })),
      ...(feature.optionalDependencies ?? []).map((key) => ({
        key,
        required: false,
      })),
    ];

    for (const dependency of dependencies) {
      const provider = providers.get(dependency.key.id);
      if (!provider) {
        if (dependency.required) {
          throw new ThrexusError(
            'MISSING_SERVICE',
            `Feature "${feature.name}" requires missing service "${dependency.key.description}".`,
          );
        }
        continue;
      }

      // 自依赖视为环的一种（单节点环）。
      if (provider.featureIndex === consumerIndex) {
        throw new ThrexusError(
          'FEATURE_DEPENDENCY_CYCLE',
          `Feature "${feature.name}" cannot depend on its own service "${dependency.key.description}".`,
        );
      }

      const providerEdges = outgoing[provider.featureIndex];
      if (providerEdges && !providerEdges.has(consumerIndex)) {
        providerEdges.add(consumerIndex);
        indegree[consumerIndex] = (indegree[consumerIndex] ?? 0) + 1;
      }
    }
  });

  // Kahn 拓扑排序：每轮对 ready 队列按索引排序，保证稳定顺序。
  const ready: number[] = [];
  indegree.forEach((degree, index) => {
    if (degree === 0) {
      ready.push(index);
    }
  });

  const orderedIndexes: number[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => left - right);
    const current = ready.shift();
    if (current === undefined) {
      break;
    }

    orderedIndexes.push(current);
    for (const consumer of outgoing[current] ?? []) {
      const nextDegree = (indegree[consumer] ?? 0) - 1;
      indegree[consumer] = nextDegree;
      if (nextDegree === 0) {
        ready.push(consumer);
      }
    }
  }

  // 未访问完所有节点说明存在环。
  if (orderedIndexes.length !== features.length) {
    const cycle = findCycle(outgoing, features);
    throw new ThrexusError(
      'FEATURE_DEPENDENCY_CYCLE',
      `Feature dependency cycle: ${cycle.join(' -> ')}.`,
    );
  }

  return {
    ordered: orderedIndexes.map((index) => {
      const feature = features[index];
      if (!feature) {
        throw new Error(`Feature index ${index} does not exist.`);
      }
      return feature;
    }),
  };
}

/**
 * DFS 三色标记找环，用于拓扑失败时的可读错误信息。
 * state: 0=未访问, 1=访问中, 2=已完成
 */
function findCycle(
  outgoing: readonly ReadonlySet<number>[],
  features: readonly ThreeFeature[],
): string[] {
  const state = range(features.length).map(() => 0);
  const path: number[] = [];

  const visit = (index: number): number[] | undefined => {
    state[index] = 1;
    path.push(index);

    for (const next of outgoing[index] ?? []) {
      if (state[next] === 0) {
        const cycle = visit(next);
        if (cycle) {
          return cycle;
        }
      } else if (state[next] === 1) {
        // 回边：从 path 中 next 的位置到当前构成环。
        const start = path.indexOf(next);
        return [...path.slice(start), next];
      }
    }

    path.pop();
    state[index] = 2;
    return undefined;
  };

  for (let index = 0; index < features.length; index += 1) {
    if (state[index] === 0) {
      const cycle = visit(index);
      if (cycle) {
        return cycle.map(
          (featureIndex) => features[featureIndex]?.name ?? `#${featureIndex}`,
        );
      }
    }
  }

  return ['unknown'];
}
