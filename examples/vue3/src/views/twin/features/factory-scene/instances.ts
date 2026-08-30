/**
 * 冲刷 pendingInstances �?InstancedMesh（须在产线构建之后）�? */

import type { FactoryWorld } from './FactorySceneService';

export function buildInstancedModels(world: FactoryWorld): void {
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
      `[factory-instances] ${key}: ${matrices.length} 个实�?�?${meshes.length} �?draw call`,
    );
  }

  world.pendingInstances.clear();
  world.pendingInstanceOwners.clear();
}
