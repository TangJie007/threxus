/**
 * GLTF 实例化选项。
 */

export type GltfTreeMode = 'auto' | 'clone' | 'skeleton-clone' | 'shared';

export type GltfMaterialMode = 'shared' | 'clone';

export type GltfTextureMode = 'shared' | 'clone';

export interface GltfInstantiateOptions {
  /**
   * 对象树策略：
   * - `auto`：有 SkinnedMesh 用 SkeletonUtils，否则 Object3D.clone
   * - `clone`：普通深层 clone
   * - `skeleton-clone`：SkeletonUtils.clone
   * - `shared`：直接使用源 scene（同时仅允许一个活动实例）
   */
  readonly mode?: GltfTreeMode;
  /** @deprecated 使用 mode；若提供则覆盖 mode（除 shared 外） */
  readonly skeleton?: 'auto' | 'clone' | 'skeleton-clone';
  /** 材质：shared（默认）或 clone（实例私有，dispose 时释放） */
  readonly materials?: GltfMaterialMode;
  /**
   * 贴图：仅在 materials:'clone' 时生效。
   * shared（默认）克隆材质仍引用共享贴图；clone 则为实例复制贴图。
   */
  readonly textures?: GltfTextureMode;
}
