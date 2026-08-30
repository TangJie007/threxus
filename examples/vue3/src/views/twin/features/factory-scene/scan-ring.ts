/**
 * 地面扫描圈。
 */

import type { ThreeFeature } from '@threxus/runtime';
import { ScanRing } from './lib/fx/ScanRing';
import { FactoryWorldService, ScanRingReadyService } from './services';

export function createScanRingFeature(): ThreeFeature {
  return {
    name: 'factory-scan-ring',
    dependencies: [FactoryWorldService],
    provides: [ScanRingReadyService],
    setup(context) {
      const world = context.inject(FactoryWorldService);
      const scanRing = new ScanRing(38, 0x40e0ff);
      scanRing.position.y = 0.02;
      world.root.add(scanRing);
      world.scanRing = scanRing;
      context.addCleanup(() => {
        scanRing.dispose();
        world.scanRing = null;
      });
      context.provide(ScanRingReadyService, { ready: true });
    },
  };
}
