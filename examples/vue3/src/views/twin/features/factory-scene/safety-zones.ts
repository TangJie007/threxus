/**
 * 电子围栏安全区。
 */

import type { ThreeFeature } from '@threxus/runtime';
import { ElectricFence } from './lib/fx/ElectricFence';
import { FactoryWorldService, type FactoryWorld } from './services';

function buildSafetyZones(world: FactoryWorld): void {
  for (const [x, z] of [
    [-24, -16],
    [4.8, 0],
    [24, 16],
  ]) {
    const fence = new ElectricFence({
      width: 7.5,
      depth: 6.5,
      height: 2.8,
      color: 0x40e0ff,
    });
    fence.position.set(x, 0, z);
    world.root.add(fence);
    world.fences.push(fence);
    world.animated.push((d) => fence.update(d));
  }
}

export function createSafetyZonesFeature(): ThreeFeature {
  return {
    name: 'factory-safety-zones',
    dependencies: [FactoryWorldService],
    setup(context) {
      buildSafetyZones(context.inject(FactoryWorldService));
    },
  };
}
