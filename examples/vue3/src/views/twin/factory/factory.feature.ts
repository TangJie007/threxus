/**
 * Factory scene Feature: materials -> world -> models -> build -> runtime facade.
 */

import { Group, type Material } from 'three';
import * as THREE from 'three'
import type { ThreeFeature } from '@threxus/runtime';
// import { factorySceneService } from './factory.service';
import { buildMaterials, disposeMaterials, mat } from './materials/Presets';
// import { ModelAssets } from './ModelAssets';
// import { ClipController } from './fx/ElectricFence';
// import { buildGround } from './ground';
// import { buildStructure } from './structure';
// import { buildCeilingLights } from './ceilingLights';
// import { buildLines } from './lines';
// import { buildPipeRack } from './pipes';
// import { buildShelves } from './shelves';
// import { buildSafetyZones } from './safetyZones';
// import { buildInstancedModels } from './instances';
// import { buildScanRing } from './scanRing';
// import { createRuntimeFacade } from './factoryRuntime';
// import {
//   FACTORY_BOUNDS,
//   FactorySceneService,
//   FactoryWorldService,
//   ModelAssetsService,
//   type FactoryWorld,
// } from './FactorySceneService';

// export {
//   FactorySceneService,
//   FactoryWorldService,
//   ModelAssetsService,
//   FACTORY_BOUNDS,
//   type FactorySceneApi,
//   type FactoryRuntime,
//   type FactoryWorld,
//   type FactoryAnimator,
//   type FactoryBounds,
// } from './FactorySceneService';
import { FactoryService, factoryService } from './factory.service';
export function createFactorySceneFeature(): ThreeFeature {
  return {
    name: 'factory-scene',
    provides: [FactoryService],
    // provides: [
    //   FactoryWorldService,
    //   ModelAssetsService,
    //   FactorySceneService,
    // ],
    async setup(context) {
      buildMaterials(); // 先建全厂共享 PBR 材质库（后续 Mesh 用 mat('steel') 等取用）
      context.addCleanup(() => disposeMaterials()); // 清理缓存避免内存泄漏
      factoryService(context);
    //   const root = new Group();
    //   root.name = 'Factory';
    //   context.scene.add(root);
    //   context.own(root);

    //   const world: FactoryWorld = {
    //     root,
    //     bounds: FACTORY_BOUNDS,
    //     devices: [],
    //     animated: [],
    //     pipes: [],
    //     fences: [],
    //     scanRing: null,
    //     clippableMaterials: [],
    //     pendingInstances: new Map(),
    //     pendingInstanceOwners: new Map(),
    //     models: null,
    //   };
    //   context.provide(FactoryWorldService, world);

    //   const models = await ModelAssets.load(async (url) => {
    //     const handle = await context.assets.acquireGLTF(url, {
    //       signal: context.signal,
    //     });
    //     context.retain(handle);
    //     return { scene: handle.value.scene };
    //   });
    //   world.models = models;
    //   context.provide(ModelAssetsService, models);
    //   context.addCleanup(() => {
    //     models.dispose();
    //     world.models = null;
    //   });

    //   buildGround(world);
    //   buildStructure(world);
    //   buildCeilingLights(world);
    //   buildLines(world);
    //   buildPipeRack(world);
    //   buildShelves(world);
    //   buildSafetyZones(world);
    //   buildInstancedModels(world);
    //   const scanRing = buildScanRing(world);
    //   context.addCleanup(() => {
    //     scanRing.dispose();
    //     world.scanRing = null;
    //   });

    //   world.clippableMaterials.push(
    //     mat('floor') as Material,
    //     mat('steel') as Material,
    //     mat('machine') as Material,
    //     mat('plastic') as Material,
    //     mat('hazard') as Material,
    //   );

    //   context.renderer.localClippingEnabled = true;
    //   context.addCleanup(() => {
    //     context.renderer.localClippingEnabled = false;
    //   });

    //   const clip = new ClipController();
    //   clip.register(world.clippableMaterials);

    //   const factory = createRuntimeFacade(world);

    //   let elapsed = 0;
    //   context.onUpdate(({ delta }) => {
    //     elapsed += delta;
    //     for (let i = 0; i < world.animated.length; i++) {
    //       world.animated[i](delta, elapsed);
    //     }
    //     world.scanRing?.update(delta);
    //   });

    //   context.addCleanup(() => {
    //     world.pipes.forEach((p) => p.dispose());
    //     world.fences.forEach((f) => f.dispose());
    //     world.root.traverse((o) => {
    //       const mesh = o as { geometry?: { dispose(): void } };
    //       mesh.geometry?.dispose();
    //     });
    //     world.root.clear();
    //     world.devices.length = 0;
    //     world.animated.length = 0;
    //     world.pipes.length = 0;
    //     world.fences.length = 0;
    //     world.clippableMaterials.length = 0;
    //   });

    //   context.provide(FactorySceneService, { factory, models, clip, world });
    },
  };
}
