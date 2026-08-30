/**
 * Factory 场景共享类型（World + Feature provide 的 API）。
 */

import type { Group, Material, Matrix4, Object3D } from 'three'
import type { DeviceRecord, DeviceStatus } from '../data/devices'
import type { FactoryPalette } from '../materials/create-palette'
import type { ElectricFence } from './elements/electric-fence'
import type { FlowPipe } from './elements/flow-pipe'
import type { ScanRing } from './elements/scan-ring'
import type { ModelAssets, ModelKey } from './models'

export interface FactoryBounds {
  width: number
  depth: number
  height: number
}

export const FACTORY_BOUNDS: FactoryBounds = {
  width: 100,
  depth: 70,
  height: 11,
}

export type FactoryAnimator = (delta: number, elapsed: number) => void

/** build* / peer Feature 共享的可变世界状态。 */
export interface FactoryWorld {
  readonly root: Group
  readonly bounds: FactoryBounds
  readonly materials: FactoryPalette
  readonly devices: DeviceRecord[]
  readonly animated: FactoryAnimator[]
  readonly pipes: FlowPipe[]
  readonly fences: ElectricFence[]
  scanRing: ScanRing | null
  readonly clippableMaterials: Material[]
  readonly pendingInstances: Map<ModelKey, Matrix4[]>
  readonly pendingInstanceOwners: Map<ModelKey, string[]>
  models: ModelAssets | null
}

/** factory-scene Feature 对外提供的服务值（含 UI 常用方法）。 */
export interface FactorySceneApi {
  readonly world: FactoryWorld
  readonly materials: FactoryPalette
  readonly models: ModelAssets
  readonly root: Object3D
  readonly devices: DeviceRecord[]
  readonly scanRing: ScanRing
  applyStatus(device: DeviceRecord, status: DeviceStatus): void
  setFlowEnabled(v: boolean): void
  setFenceAlert(v: boolean): void
  findDevice(id: string): DeviceRecord | undefined
}
