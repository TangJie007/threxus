/**
 * 冲刷 pendingInstances → InstancedMesh（须在产线构建之后）。
 */

import { DEFAULT_PICK_LAYER, enablePickLayer } from '@threxus/runtime';
import type { FactoryModelsApi } from '../../models/models.service';
import type { FactoryWorld } from '../types';

export function buildInstancedModels(
  world: FactoryWorld,
  models: FactoryModelsApi,
): void {
  for (const [key, matrices] of world.pendingInstances) {
    const meshes = models.instance(key, matrices);
    const owners = world.pendingInstanceOwners.get(key);

    for (const im of meshes) {
      if (owners) im.userData.instancePickIds = owners;
      enablePickLayer(im, DEFAULT_PICK_LAYER, false);
      world.root.add(im);
    }

    console.info(
      `[factory-instances] ${key}: ${matrices.length} 个实例 → ${meshes.length} 个 draw call`,
    );
  }

  world.pendingInstances.clear();
  world.pendingInstanceOwners.clear();
}
