/**
 * 冲刷 pendingInstances → InstancedMesh（须在产线 Feature 之后）。
 */

import type { ThreeFeature } from '@threxus/runtime';
import {
  FactoryWorldService,
  LinesBuiltService,
  ModelAssetsService,
  type FactoryWorld,
} from './services';

function buildInstancedModels(world: FactoryWorld): void {
  if (!world.models) return;

  for (const [key, matrices] of world.pendingInstances) {
    const meshes = world.models.instance(key, matrices);
    const owners = world.pendingInstanceOwners.get(key);

    for (const im of meshes) {
      if (owners) im.userData.instancePickIds = owners;
      im.layers.enable(1);
      world.root.add(im);
    }

    console.info(
      `[factory-instances] ${key}: ${matrices.length} 个实例 → ${meshes.length} 个 draw call`,
    );
  }

  world.pendingInstances.clear();
  world.pendingInstanceOwners.clear();
}

export function createInstancesFeature(): ThreeFeature {
  return {
    name: 'factory-instances',
    dependencies: [FactoryWorldService, ModelAssetsService, LinesBuiltService],
    setup(context) {
      buildInstancedModels(context.inject(FactoryWorldService));
    },
  };
}
