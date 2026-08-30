import type {
  CameraRigMode,
  CameraRigServiceType,
  EffectComposerServiceType,
  LabelsServiceType,
  RuntimeStats,
  SelectionServiceType,
  StatsServiceType,
} from '@threxus/runtime';
import type { DeviceRecord, DeviceStatus } from './lib/data/devices';
import type { Factory } from './lib/scene/Factory';
import type { ClipController } from './lib/fx/ElectricFence';

export interface TwinToggles {
  outline: boolean;
  bloom: boolean;
  ao: boolean;
  flow: boolean;
  fence: boolean;
  clip: boolean;
  labels: boolean;
}

export interface TwinKpi {
  run: number;
  warn: number;
  error: number;
  oee: number;
}

/** Vue 侧可读的桥接状态（由 twin-bridge Feature 写入）。 */
export interface TwinBridge {
  factory: Factory | null;
  clip: ClipController | null;
  selection: SelectionServiceType | null;
  stats: StatsServiceType | null;
  composer: EffectComposerServiceType | null;
  labels: LabelsServiceType | null;
  cameraRig: CameraRigServiceType | null;
  devices: DeviceRecord[];
  selectedId: string | null;
  cameraMode: CameraRigMode;
  toggles: TwinToggles;
  kpi: TwinKpi;
  latestStats: RuntimeStats | null;
  ready: boolean;
  focusDevice: (id: string) => void;
  clearSelection: () => void;
  setCameraMode: (mode: CameraRigMode) => void;
  setToggle: (key: keyof TwinToggles, value: boolean) => void;
  hoverPreview: (id: string | null) => void;
}

export type { DeviceRecord, DeviceStatus };
