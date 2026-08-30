/**
 * Factory scene shared state + service keys.
 * World is provided by factory-scene Feature; peer Features (e.g. agv) inject it.
 */

import type { Group, Material, Matrix4, Object3D } from 'three';
import { createServiceKey } from '@threxus/runtime';
import type { DeviceRecord, DeviceStatus } from './devices';
import type { FlowPipe } from './fx/FlowPipe';
import type { ElectricFence, ClipController } from './fx/ElectricFence';
import type { ScanRing } from './fx/ScanRing';
import type { ModelAssets, ModelKey } from './ModelAssets';

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

/** Shared mutable world for build + runtime. */
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

/** Runtime facade for twin-bridge / UI (Factory-like API). */
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

export const FactorySceneService =
  createServiceKey<FactorySceneApi>('factory-scene');
