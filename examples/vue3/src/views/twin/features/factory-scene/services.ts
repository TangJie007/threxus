/**
 * 工厂场景共享状态与服务键。
 * 各 Feature 通过 FactoryWorldService 协作，避免巨型 Factory 上帝类。
 */

import type { Group, Material, Matrix4, Object3D } from 'three';
import { createServiceKey } from '@threxus/runtime';
import type { DeviceRecord, DeviceStatus } from './lib/data/devices';
import type { FlowPipe } from './lib/fx/FlowPipe';
import type { ElectricFence, ClipController } from './lib/fx/ElectricFence';
import type { ScanRing } from './lib/fx/ScanRing';
import type { ModelAssets, ModelKey } from './lib/scene/ModelAssets';

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

export type FactoryAnimator = (delta: number, elapsed: number) => void;

/** 场景世界：构建期与运行期共享的可变状态。 */
export interface FactoryWorld {
  readonly root: Group;
  readonly bounds: FactoryBounds;
  readonly devices: DeviceRecord[];
  readonly animated: FactoryAnimator[];
  readonly pipes: FlowPipe[];
  readonly fences: ElectricFence[];
  scanRing: ScanRing | null;
  readonly clippableMaterials: Material[];
  readonly pendingInstances: Map<ModelKey, Matrix4[]>;
  readonly pendingInstanceOwners: Map<ModelKey, string[]>;
  models: ModelAssets | null;
}

/** twin-bridge / UI 使用的运行时门面（保持原 Factory API 形态）。 */
export interface FactoryRuntime {
  readonly root: Object3D;
  readonly devices: DeviceRecord[];
  readonly scanRing: ScanRing;
  readonly clippableMaterials: Material[];
  applyStatus(device: DeviceRecord, status: DeviceStatus): void;
  setFlowEnabled(v: boolean): void;
  setFenceAlert(v: boolean): void;
  findDevice(id: string): DeviceRecord | undefined;
}

export interface FactorySceneApi {
  readonly factory: FactoryRuntime;
  readonly models: ModelAssets;
  readonly clip: ClipController;
  readonly world: FactoryWorld;
}

export const FactoryWorldService =
  createServiceKey<FactoryWorld>('factory-world');

export const ModelAssetsService =
  createServiceKey<ModelAssets>('factory-models');

/** 材质已构建（几何 Feature 依赖）。 */
export const MaterialsReadyService = createServiceKey<{ readonly ready: true }>(
  'factory-materials-ready',
);

/** 产线已构建（instances 依赖，保证 pending 已收集完）。 */
export const LinesBuiltService = createServiceKey<{ readonly ready: true }>(
  'factory-lines-built',
);

/** 扫描圈已就绪（runtime 门面依赖）。 */
export const ScanRingReadyService = createServiceKey<{ readonly ready: true }>(
  'factory-scan-ring-ready',
);

export const FactorySceneService =
  createServiceKey<FactorySceneApi>('factory-scene');
