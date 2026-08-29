import { ThrexusError } from '../errors';
import { resolveFeatureGraph, type ResolvedFeatureGraph } from './FeatureGraph';
import type { ThreeFeature } from './ThreeFeature';

export class FeatureRegistry {
  readonly #features: ThreeFeature[] = [];
  #locked = false;

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

  lockAndResolve(): ResolvedFeatureGraph {
    this.#locked = true;
    return resolveFeatureGraph(this.#features);
  }
}
