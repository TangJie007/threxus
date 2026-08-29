import { describe, expect, it } from 'vitest';
import { resolveFeatureGraph } from '../../src/feature/FeatureGraph';
import { createServiceKey, type ThreeFeature } from '../../src';

const setup = () => undefined;

describe('resolveFeatureGraph', () => {
  it('uses a stable topological order', () => {
    const service = createServiceKey<object>('service');
    const consumer: ThreeFeature = {
      name: 'consumer',
      dependencies: [service],
      setup,
    };
    const unrelated: ThreeFeature = { name: 'unrelated', setup };
    const provider: ThreeFeature = {
      name: 'provider',
      provides: [service],
      setup,
    };

    const graph = resolveFeatureGraph([consumer, unrelated, provider]);

    expect(graph.ordered.map((feature) => feature.name)).toEqual([
      'unrelated',
      'provider',
      'consumer',
    ]);
  });

  it('rejects a missing required service', () => {
    const missing = createServiceKey<object>('missing');

    expect(() =>
      resolveFeatureGraph([
        { name: 'consumer', dependencies: [missing], setup },
      ]),
    ).toThrow(/requires missing service/);
  });

  it('allows a missing optional service', () => {
    const optional = createServiceKey<object>('optional');

    expect(
      resolveFeatureGraph([
        { name: 'consumer', optionalDependencies: [optional], setup },
      ]).ordered,
    ).toHaveLength(1);
  });

  it('rejects duplicate service providers', () => {
    const service = createServiceKey<object>('service');

    expect(() =>
      resolveFeatureGraph([
        { name: 'first', provides: [service], setup },
        { name: 'second', provides: [service], setup },
      ]),
    ).toThrow(/declared by both/);
  });

  it('rejects self dependencies', () => {
    const service = createServiceKey<object>('service');

    expect(() =>
      resolveFeatureGraph([
        {
          name: 'self',
          provides: [service],
          dependencies: [service],
          setup,
        },
      ]),
    ).toThrow(/own service/);
  });

  it('reports dependency cycles', () => {
    const firstService = createServiceKey<object>('first-service');
    const secondService = createServiceKey<object>('second-service');

    expect(() =>
      resolveFeatureGraph([
        {
          name: 'first',
          provides: [firstService],
          dependencies: [secondService],
          setup,
        },
        {
          name: 'second',
          provides: [secondService],
          dependencies: [firstService],
          setup,
        },
      ]),
    ).toThrow(/first -> second -> first|second -> first -> second/);
  });

  it('rejects a service declared as required and optional', () => {
    const service = createServiceKey<object>('service');
    const provider: ThreeFeature = {
      name: 'provider',
      provides: [service],
      setup,
    };

    expect(() =>
      resolveFeatureGraph([
        provider,
        {
          name: 'consumer',
          dependencies: [service],
          optionalDependencies: [service],
          setup,
        },
      ]),
    ).toThrow(/both required and optional/);
  });
});
