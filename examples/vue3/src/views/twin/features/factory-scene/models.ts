/**
 * glTF 素材 Feature：加载失败不抛错，场景可降级到程序化几何。
 */

import type { ThreeFeature } from '@threxus/runtime';
import { ModelAssets } from './lib/scene/ModelAssets';
import {
  FactoryWorldService,
  ModelAssetsService,
} from './services';

export function createModelsFeature(): ThreeFeature {
  return {
    name: 'factory-models',
    dependencies: [FactoryWorldService],
    provides: [ModelAssetsService],
    async setup(context) {
      const world = context.inject(FactoryWorldService);

      const models = await ModelAssets.load(async (url) => {
        const handle = await context.assets.acquireGLTF(url, {
          signal: context.signal,
        });
        context.retain(handle);
        return { scene: handle.value.scene };
      });

      world.models = models;
      context.provide(ModelAssetsService, models);
      context.addCleanup(() => {
        models.dispose();
        world.models = null;
      });
    },
  };
}
