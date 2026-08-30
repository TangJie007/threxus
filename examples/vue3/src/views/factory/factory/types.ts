/**
 * Factory scene shared state + service types.
 */

import type { Group, Material, Matrix4, Object3D } from 'three';
import type { DeviceRecord, DeviceStatus } from '../data/devices';
import type {
  ClipController,
  FenceController,
  FlowController,
  ScanRingController,
} from '../types';
import type { ModelAssets, ModelKey } from './models';

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
  readonly pipes: FlowController[];
  readonly fences: FenceController[];
  scanRing: ScanRingController | null;
  readonly clippableMaterials: Material[];
  readonly pendingInstances: Map<ModelKey, Matrix4[]>;
  readonly pendingInstanceOwners: Map<ModelKey, string[]>;
  models: ModelAssets | null;
}

/** Runtime facade for bridge / UI (Factory-like API). */
export interface FactoryRuntime {
  readonly root: Object3D;
  readonly devices: DeviceRecord[];
  readonly scanRing: ScanRingController;
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

export type {
  ClipController,
  FenceController,
  FlowController,
  ScanRingController,
} from '../types';
