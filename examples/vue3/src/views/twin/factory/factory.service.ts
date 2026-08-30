import { createServiceKey, type ThreeContext } from '@threxus/runtime';
import { Group } from 'three';

import { buildGround } from './elements/ground';
import { buildStructure } from './elements/structure';
import { buildCeilingLights } from './elements/ceilingLights';

export interface FactoryWorld {
    readonly root: Group;
    readonly bounds: FactoryBounds;
    // readonly devices: DeviceRecord[];
    // readonly animated: FactoryAnimator[];
    // readonly fences: ElectricFence[];
    // scanRing: ScanRing | null;
    // readonly clippableMaterials: Material[];
    // readonly pendingInstances: Map<ModelKey, Matrix4[]>;
    // readonly pendingInstanceOwners: Map<ModelKey, string[]>;
    // models: ModelAssets | null;
}

/** 工厂 World：管廊 / AGV 等 peer Feature 通过 inject 挂到 root */
export const FactoryService =
  createServiceKey<FactoryWorld>('factory-service');
export interface FactoryBounds {
    width: number;
    depth: number;
    height: number;
}
export const FACTORY_BOUNDS: FactoryBounds = {
    width: 100,
    depth: 70,
    height: 11,
};
  
export const factoryService = (context: ThreeContext)=>{
    const root = new Group();
    root.name = 'Factory';
    context.scene.add(root);
    context.own(root);
    const world: FactoryWorld = {
        root,
        bounds: FACTORY_BOUNDS,
        // devices: [],
        // animated: [],
        // pipes: [],
        // fences: [],
        // scanRing: null,
        // clippableMaterials: [],
        // pendingInstances: new Map(),
        // pendingInstanceOwners: new Map(),
        // models: null,
    };

    buildGround(world);
    buildStructure(world);
    buildCeilingLights(world);
    
    context.provide(FactoryService, world);
};