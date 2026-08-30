/**
 * 电子围栏安全区。
 */

import { createElectricFence } from '../../fx/electric-fence';
import type { FactoryWorld } from '../types';

export function buildSafetyZones(world: FactoryWorld): void {
  for (const [x, z] of [
    [-24, -16],
    [4.8, 0],
    [24, 16],
  ]) {
    const fence = createElectricFence({
      width: 7.5,
      depth: 6.5,
      height: 2.8,
      color: 0x40e0ff,
    });
    fence.root.position.set(x, 0, z);
    world.root.add(fence.root);
    world.fences.push(fence);
    world.animated.push((d) => fence.update(d));
  }
}
