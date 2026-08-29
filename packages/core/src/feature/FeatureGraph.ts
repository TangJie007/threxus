import { ThrexusError } from '../errors';
import type { ServiceKey } from '../services/ServiceKey';
import type { ThreeFeature } from './ThreeFeature';

interface ProviderRecord {
  readonly featureIndex: number;
  readonly featureName: string;
  readonly key: ServiceKey<unknown>;
}

export interface ResolvedFeatureGraph {
  readonly ordered: readonly ThreeFeature[];
}

export function resolveFeatureGraph(
  features: readonly ThreeFeature[],
): ResolvedFeatureGraph {
  const names = new Map<string, number>();
  const providers = new Map<symbol, ProviderRecord>();

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

  const outgoing = features.map(() => new Set<number>());
  const indegree = features.map(() => 0);

  features.forEach((feature, consumerIndex) => {
    const required = new Set(feature.dependencies?.map((key) => key.id) ?? []);

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

function findCycle(
  outgoing: readonly ReadonlySet<number>[],
  features: readonly ThreeFeature[],
): string[] {
  const state = features.map(() => 0);
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
