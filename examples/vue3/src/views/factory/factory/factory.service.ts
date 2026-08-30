/**
 * Factory scene service — defineService provider for full factory world.
 */

import { defineService } from '@threxus/runtime';
import { Group, type Material } from 'three';
import { buildMaterials, disposeMaterials, mat } from '../materials/Presets';
import { createClipController } from '../fx/electric-fence';
import { loadModelAssets } from './models';
import { createRuntimeFacade } from './runtime';
import {
  FACTORY_BOUNDS,
  type FactorySceneApi,
  type FactoryWorld,
} from './types';
import { buildGround } from './elements/ground';
import { buildStructure } from './elements/structure';
import { buildCeilingLights } from './elements/ceiling-lights';
import { buildLines } from './elements/lines';
import { buildPipeRack } from './elements/pipes';
import { buildShelves } from './elements/shelves';
import { buildSafetyZones } from './elements/safety-zones';
import { buildInstancedModels } from './elements/instances';
import { buildScanRing } from './elements/scan-ring';

export const FactorySceneService = defineService<FactorySceneApi>({
  name: 'factory-scene',
  featureName: 'factory-scene',
  async create(context) {
    buildMaterials();
    context.addCleanup(() => disposeMaterials());

    const root = new Group();
    root.name = 'Factory';
    context.scene.add(root);
    context.own(root);

    const world: FactoryWorld = {
      root,
      bounds: FACTORY_BOUNDS,
      devices: [],
      animated: [],
      pipes: [],
      fences: [],
      scanRing: null,
      clippableMaterials: [],
      pendingInstances: new Map(),
      pendingInstanceOwners: new Map(),
      models: null,
    };

    const models = await loadModelAssets(async (url) => {
      const handle = await context.assets.acquireGLTF(url, {
        signal: context.signal,
      });
      context.retain(handle);
      return { scene: handle.value.scene };
    });
    world.models = models;
    context.addCleanup(() => {
      models.dispose();
      world.models = null;
    });

    buildGround(world);
    buildStructure(world);
    buildCeilingLights(world);
    buildLines(world);
    buildPipeRack(world);
    buildShelves(world);
    buildSafetyZones(world);
    buildInstancedModels(world);
    const scanRing = buildScanRing(world);
    context.addCleanup(() => {
      scanRing.dispose();
      world.scanRing = null;
    });

    world.clippableMaterials.push(
      mat('floor') as Material,
      mat('steel') as Material,
      mat('machine') as Material,
      mat('plastic') as Material,
      mat('hazard') as Material,
    );

    context.renderer.localClippingEnabled = true;
    context.addCleanup(() => {
      context.renderer.localClippingEnabled = false;
    });

    const clip = createClipController();
    clip.register(world.clippableMaterials);

    const factory = createRuntimeFacade(world);

    let elapsed = 0;
    context.onUpdate(({ delta }) => {
      elapsed += delta;
      for (let i = 0; i < world.animated.length; i++) {
        world.animated[i](delta, elapsed);
      }
      world.scanRing?.update(delta);
    });

    context.addCleanup(() => {
      world.pipes.forEach((p) => p.dispose());
      world.fences.forEach((f) => f.dispose());
      world.root.traverse((o) => {
        const mesh = o as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
      world.root.clear();
      world.devices.length = 0;
      world.animated.length = 0;
      world.pipes.length = 0;
      world.fences.length = 0;
      world.clippableMaterials.length = 0;
    });

    return { factory, models, clip, world };
  },
});

export { FACTORY_BOUNDS };
export type {
  FactorySceneApi,
  FactoryRuntime,
  FactoryWorld,
  FactoryAnimator,
  FactoryBounds,
} from './types';
