/**
 * @threxus/runtime 公共 API 入口。
 *
 * 当前阶段（M0–M8）导出：
 * - ThreeApp 工厂与类型
 * - Feature 契约（ThreeFeature / ThreeContext）
 * - Scheduler 与帧回调类型
 * - 渲染类型（Camera / Renderer Options）
 * - AssetManager / AssetHandle / Loader / GLTF 实例
 * - InputManager / ScopedInputManager / ThreePointerEvent
 * - 生命周期原语（CleanupStack / Disposable）
 * - 服务标识（createServiceKey）
 * - 运行时错误（ThrexusError）
 */

export {
  createThreeApp,
  type AppState,
  type FeatureSnapshot,
  type RuntimeSnapshot,
  type SetCameraOptions,
  type ThreeApp,
  type ThreeAppOptions,
} from './app/ThreeApp';
export {
  type ProvideServiceOptions,
  type ThreeContext,
  type ThreeFeature,
} from './feature/ThreeFeature';
export {
  CleanupStack,
  type CleanupStackState,
} from './lifecycle/CleanupStack';
export {
  type Cleanup,
  type Disposable,
  isDisposable,
} from './lifecycle/Disposable';
export type {
  CameraChangedEvent,
  CameraOptions,
  OrthographicCameraOptions,
  Ownership,
  PerspectiveCameraOptions,
  PixelRatioOption,
  PixelRatioPolicy,
  RendererOptions,
  ResizeOptions,
  SceneOptions,
  Vector3Like,
} from './rendering/types';
export type { RenderPipeline } from './rendering/RenderPipeline';
export type { RenderingSnapshot } from './rendering/RenderingRuntime';
export {
  Scheduler,
  type RenderMode,
  type SchedulerErrorPolicy,
  type SchedulerOptions,
  type SchedulerSnapshot,
} from './scheduler/Scheduler';
export type { FrameInfo } from './scheduler/FrameInfo';
export {
  createBrowserRafDriver,
  ManualRafDriver,
  type RafDriver,
} from './scheduler/RafDriver';
export type {
  FixedUpdateCallback,
  RenderCallback,
  SchedulerPhase,
  TaskOptions,
  UpdateCallback,
} from './scheduler/SchedulerTask';
export {
  createServiceKey,
  type ServiceKey,
} from './services/ServiceKey';
export { ThrexusError, type ThrexusErrorCode } from './errors';
export {
  ReleasedAssetHandleError,
  createAssetManager,
  createCubeTextureAssetLoader,
  createDeferredTestLoader,
  createFileAssetLoader,
  createGltfAssetLoader,
  createTextureAssetLoader,
  normalizeAssetKey,
  resolveAssetSource,
  stableSerialize,
  GltfAsset,
  type AcquireOptions,
  type AssetEntryState,
  type AssetHandle,
  type AssetHandleState,
  type AssetKey,
  type AssetKeyParts,
  type AssetLoadContext,
  type AssetLoader,
  type AssetLifetimeHooks,
  type AssetManager,
  type AssetManagerOptions,
  type AssetManagerSnapshot,
  type AssetPin,
  type BindableAsset,
  type CubeTextureLoaderOptions,
  type DeferredTestLoader,
  type FileAssetResult,
  type FileLoaderOptions,
  type GltfInstance,
  type GltfInstantiateOptions,
  type GltfMaterialMode,
  type GltfSource,
  type GltfTextureMode,
  type GltfTreeMode,
  type NormalizeAssetKeyOptions,
  type TextureLoaderOptions,
} from './assets';
export {
  clientToNdc,
  createInputManager,
  type InputManager,
  type InputManagerOptions,
  type InputManagerSnapshot,
  type NdcPoint,
  type ScopedInputManager,
  type ThreePointerEvent,
  type ThreePointerEventType,
  type ThreePointerHandler,
} from './input';
