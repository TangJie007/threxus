export type {
  GltfInstantiateOptions,
  GltfMaterialMode,
  GltfTextureMode,
  GltfTreeMode,
} from './GltfInstantiateOptions';
export { GltfAsset, type GltfSource } from './GltfAsset';
export {
  ManagedGltfInstance,
  type GltfInstance,
} from './GltfInstance';
export {
  createGltfAssetLoader,
  type GltfAssetLoader,
  type GltfAssetLoaderOptions,
} from './GltfAssetLoader';
export {
  cloneMaterialsOnObject,
  collectSharedResources,
  disposeOwnedInstanceResources,
  disposeSharedResources,
  hasSkinnedMesh,
  type SharedGltfResources,
} from './GltfResourceOwnership';
