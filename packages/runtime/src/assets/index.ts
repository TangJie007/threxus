/**
 * 资产模块公共导出。
 */

export { ReleasedAssetHandleError } from './AssetErrors';
export {
  normalizeAssetKey,
  resolveAssetSource,
  type AssetKey,
  type AssetKeyParts,
  type NormalizeAssetKeyOptions,
} from './AssetKey';
export {
  type AssetHandle,
  type AssetHandleState,
  type AssetPin,
} from './AssetHandle';
export type { AssetEntryState } from './AssetCacheEntry';
export type { AssetLoadContext, AssetLoader } from './AssetLoader';
export type {
  AssetLifetimeHooks,
  BindableAsset,
} from './AssetLifetime';
export { isBindableAsset } from './AssetLifetime';
export {
  createAssetManager,
  type AcquireOptions,
  type AssetManager,
  type AssetManagerOptions,
  type AssetManagerSnapshot,
} from './AssetManager';
export { stableSerialize } from './StableAssetKeySerializer';
export {
  createCubeTextureAssetLoader,
  createFileAssetLoader,
  createTextureAssetLoader,
  type CubeTextureLoaderOptions,
  type FileAssetResult,
  type FileLoaderOptions,
  type TextureLoaderOptions,
} from './loaders';
export {
  createDeferredTestLoader,
  type DeferredTestLoader,
} from './testing';
export {
  GltfAsset,
  ManagedGltfInstance,
  cloneMaterialsOnObject,
  collectSharedResources,
  createGltfAssetLoader,
  disposeOwnedInstanceResources,
  disposeSharedResources,
  hasSkinnedMesh,
  type GltfInstance,
  type GltfInstantiateOptions,
  type GltfMaterialMode,
  type GltfSource,
  type GltfTextureMode,
  type GltfTreeMode,
  type SharedGltfResources,
} from './gltf';
