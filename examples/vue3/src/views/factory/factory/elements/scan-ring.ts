/**
 * 地面扫描圈。
 */

import { ScanRing } from '../../fx/scan-ring'
import type { FactoryWorld } from '../types'

export function buildScanRing(world: FactoryWorld): ScanRing {
  const scanRing = new ScanRing(38, 0x40e0ff)
  scanRing.position.y = 0.02
  world.root.add(scanRing)
  world.scanRing = scanRing
  return scanRing
}
