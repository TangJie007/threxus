/**
 * ThreeApp 配置、快照与相机切换选项。
 */

import type { Logger } from '../../diagnostics/Logger';
import type { EntitySnapshot } from '../../entities/EntityRegistry';
import type {
  AssetLoader,
  AssetManagerOptions,
  AssetManagerSnapshot,
} from '../../assets';
import type { FeatureScopeState } from '../../feature/FeatureScope';
import type {
  InputManagerOptions,
  InputManagerSnapshot,
} from '../../input';
import type { RenderingSnapshot } from '../../rendering/RenderingRuntime';
import type { GraphicsState } from '../../rendering/GraphicsState';
import type {
  CameraSource,
  Ownership,
  PixelRatioOption,
  RendererSource,
  ResizeOptions,
  SceneSource,
} from '../../rendering/types';
import type { RafDriver } from '../../scheduler/RafDriver';
import type {
  RenderMode,
  SchedulerErrorPolicy,
  SchedulerSnapshot,
} from '../../scheduler/Scheduler';
import type { ServiceSnapshot } from '../../services/ServiceContainer';
import type { AppState } from './AppState';

export interface ThreeAppOptions {
  readonly canvas: HTMLCanvasElement;
  readonly scene?: SceneSource;
  readonly camera?: CameraSource;
  readonly renderer?: RendererSource;
  readonly pixelRatio?: PixelRatioOption;
  readonly resize?: boolean | ResizeOptions;
  /** 连续渲染（默认）或按需 invalidate。 */
  readonly renderMode?: RenderMode;
  /** 固定时间步（秒）；设置后启用 onFixedUpdate。 */
  readonly fixedStep?: number;
  /** 单帧 delta 上限（秒），默认 0.1。 */
  readonly maxDelta?: number;
  /** 单帧 fixedUpdate 最大迭代次数，默认 5。 */
  readonly maxFixedStepsPerFrame?: number;
  /** 帧回调异常策略，默认 continue。 */
  readonly errorPolicy?: SchedulerErrorPolicy;
  /** 自定义 RAF 驱动（测试用）。 */
  readonly rafDriver?: RafDriver;
  /** AssetManager 选项；默认注册 texture / cube-texture / file / gltf / environment-map Loader。 */
  readonly assets?: AssetManagerOptions & {
    readonly registerDefaultLoaders?: boolean;
    readonly loaders?: readonly AssetLoader[];
    /** 默认 GLTF Loader 的压缩管线选项。 */
    readonly gltf?: {
      readonly dracoPath?: string;
      readonly ktx2Path?: string;
      /** 默认 true。 */
      readonly meshopt?: boolean;
    };
  };
  /** InputManager 选项（click 容差、touch-action、穿透分发等）。 */
  readonly input?: Omit<InputManagerOptions, 'canvas' | 'getCamera'>;
  /** 诊断：日志与生命周期警告。 */
  readonly diagnostics?: {
    readonly logger?: Logger;
    /** 默认非 production 开启。 */
    readonly lifecycleWarnings?: boolean;
  };
}

/** inspect() 返回的单个 Feature 快照。 */
export interface FeatureSnapshot {
  readonly name: string;
  readonly state: FeatureScopeState | 'registered';
  readonly cleanupCount: number;
}

export interface RuntimeCounts {
  readonly features: number;
  readonly activeFeatures: number;
  readonly services: number;
  readonly entities: number;
}

/** inspect() 返回的运行时快照，供调试与 E2E 断言。 */
export interface RuntimeSnapshot {
  readonly state: AppState;
  readonly graphicsState: GraphicsState;
  /** @deprecated 使用 counts.services；保留用于兼容现有调用方。 */
  readonly services: number;
  readonly counts: RuntimeCounts;
  readonly serviceEntries: readonly ServiceSnapshot[];
  readonly entities: readonly EntitySnapshot[];
  readonly scheduler: SchedulerSnapshot;
  readonly rendering: RenderingSnapshot | null;
  readonly assets: AssetManagerSnapshot;
  readonly input: InputManagerSnapshot | null;
  readonly features: readonly FeatureSnapshot[];
}

export interface SetCameraOptions {
  readonly ownership?: Ownership;
}
