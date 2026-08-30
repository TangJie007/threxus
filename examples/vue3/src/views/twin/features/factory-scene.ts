/**
 * 工厂场景 Feature：材质 → glTF → Factory，对应 test 的 boot 场景装配段。
 */

import type { ThreeFeature } from '@threxus/runtime';
import { createServiceKey } from '@threxus/runtime';
import { buildMaterials, disposeMaterials } from '../lib/materials/Presets';
import { ClipController } from '../lib/fx/ElectricFence';
import { Factory } from '../lib/scene/Factory';
import { ModelAssets } from '../lib/scene/ModelAssets';

export interface FactorySceneService {
  readonly factory: Factory;
  readonly models: ModelAssets;
  readonly clip: ClipController;
}

export const FactorySceneService =
  createServiceKey<FactorySceneService>('factory-scene');

export function createFactorySceneFeature(): ThreeFeature {
  return {
    name: 'factory-scene',
    provides: [FactorySceneService],
    async setup(context) {
      buildMaterials();
      context.addCleanup(() => disposeMaterials());

      context.renderer.localClippingEnabled = true;
      context.addCleanup(() => {
        context.renderer.localClippingEnabled = false;
      });

      const models = await ModelAssets.load(async (url) => {
        const handle = await context.assets.acquireGLTF(url, {
          signal: context.signal,
        });
        context.retain(handle);
        return { scene: handle.value.scene };
      });
      context.addCleanup(() => models.dispose());

      const factory = new Factory(models);
      context.scene.add(factory.root);
      context.addCleanup(() => {
        factory.dispose();
        factory.root.removeFromParent();
      });

      const clip = new ClipController();
      clip.register(factory.clippableMaterials);

      let elapsed = 0;
      context.onUpdate(({ delta }) => {
        elapsed += delta;
        factory.update(delta, elapsed);
      });

      context.provide(FactorySceneService, { factory, models, clip });
    },
  };
}
