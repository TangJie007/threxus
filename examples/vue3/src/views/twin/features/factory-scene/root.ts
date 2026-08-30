/**
 * 工厂根节点 Feature：创建 Group 与共享 World。
 */

import { Group } from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import {
  FACTORY_BOUNDS,
  FactoryWorldService,
  MaterialsReadyService,
  type FactoryWorld,
} from './services';

export function createFactoryRootFeature(): ThreeFeature {
  return {
    name: 'factory-root',
    dependencies: [MaterialsReadyService],
    provides: [FactoryWorldService],
    setup(context) {
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

      context.provide(FactoryWorldService, world);
    },
  };
}
