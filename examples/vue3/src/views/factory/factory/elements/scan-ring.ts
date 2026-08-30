/**
 * 地面扫描圈 */

import { createScanRing } from '../../fx/scan-ring';
import type { ScanRingController } from '../../types';
import type { FactoryWorld } from '../types';

export function buildScanRing(world: FactoryWorld): ScanRingController {
  const scanRing = createScanRing(38, 0x40e0ff);
  scanRing.root.position.y = 0.02;
  world.root.add(scanRing.root);
  world.scanRing = scanRing;
  return scanRing;
}
