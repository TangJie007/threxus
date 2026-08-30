import type { Material, Object3D } from 'three';
import type {
  CameraRigMode,
  CameraRigServiceType,
  EffectComposerServiceType,
  LabelsServiceType,
  RuntimeStats,
  SelectionServiceType,
  StatsServiceType,
} from '@threxus/runtime';
import type { DeviceRecord, DeviceStatus } from './data/devices';
import type { FactoryRuntime } from './factory/types';

export interface FlowController {
  readonly root: Object3D;
  flowEnabled: boolean;
  update(delta: number): void;
  dispose(): void;
}

export interface FenceController {
  readonly root: Object3D;
  alert: boolean;
  update(delta: number): void;
  dispose(): void;
}

export interface ScanRingController {
  readonly root: Object3D;
  update(delta: number): void;
  focusAt(x: number, z: number): void;
  dispose(): void;
}

export interface ClipController {
  register(materials: Material[]): void;
  setEnabled(v: boolean): void;
  setHeight(h: number): void;
}

export interface FactoryToggles {
  outline: boolean;
  bloom: boolean;
  ao: boolean;
  flow: boolean;
  fence: boolean;
  clip: boolean;
  labels: boolean;
}

export interface FactoryKpi {
  run: number;
  warn: number;
  error: number;
  oee: number;
}

/** Vue 侧可读的桥接状态（由 bridge Feature 写入）。 */
export interface FactoryBridge {
  factory: FactoryRuntime | null;
  clip: ClipController | null;
  selection: SelectionServiceType | null;
  stats: StatsServiceType | null;
  composer: EffectComposerServiceType | null;
  labels: LabelsServiceType | null;
  cameraRig: CameraRigServiceType | null;
  devices: DeviceRecord[];
  selectedId: string | null;
  cameraMode: CameraRigMode;
  toggles: FactoryToggles;
  kpi: FactoryKpi;
  latestStats: RuntimeStats | null;
  ready: boolean;
  focusDevice: (id: string) => void;
  clearSelection: () => void;
  setCameraMode: (mode: CameraRigMode) => void;
  setToggle: (key: keyof FactoryToggles, value: boolean) => void;
  hoverPreview: (id: string | null) => void;
}

export type { DeviceRecord, DeviceStatus };
