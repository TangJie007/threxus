/**
 * GltfAsset：缓存中的源 GLTF + instantiate API。
 */

import type { Object3D } from 'three';
import { clone as skeletonCloneObject } from 'three/addons/utils/SkeletonUtils.js';
import { ThrexusError } from '../../errors';
import type { AssetLifetimeHooks, BindableAsset } from '../AssetLifetime';
import type { GltfInstantiateOptions } from './GltfInstantiateOptions';
import {
  ManagedGltfInstance,
  type GltfInstance,
} from './GltfInstance';
import {
  cloneMaterialsOnObject,
  collectSharedResources,
  disposeSharedResources,
  hasSkinnedMesh,
  type SharedGltfResources,
} from './GltfResourceOwnership';

export interface GltfSource {
  readonly scene: Object3D;
  readonly scenes?: Object3D[];
  readonly animations?: unknown[];
  readonly cameras?: unknown[];
  readonly asset?: Record<string, unknown>;
  readonly parser?: unknown;
  readonly userData?: Record<string, unknown>;
}

export class GltfAsset implements BindableAsset {
  readonly #source: GltfSource;
  readonly #shared: SharedGltfResources;
  #hooks: AssetLifetimeHooks | undefined;
  #sharedInstance: GltfInstance | undefined;
  #sharedDisposed = false;

  constructor(source: GltfSource) {
    this.#source = source;
    this.#shared = collectSharedResources(source.scene);
  }

  /** 源 scene（只读用途；挂载请用 instantiate）。 */
  get scene(): Object3D {
    return this.#source.scene;
  }

  get source(): GltfSource {
    return this.#source;
  }

  bindLifetime(hooks: AssetLifetimeHooks): void {
    this.#hooks = hooks;
  }

  instantiate(options: GltfInstantiateOptions = {}): GltfInstance {
    if (this.#sharedDisposed) {
      throw new ThrexusError(
        'ASSET_STATE',
        'Cannot instantiate a disposed GltfAsset.',
      );
    }
    if (!this.#hooks) {
      throw new ThrexusError(
        'ASSET_STATE',
        'GltfAsset is not bound to AssetManager lifetime.',
      );
    }

    const mode = resolveTreeMode(this.#source.scene, options);
    const materials = options.materials ?? 'shared';
    const textures = options.textures ?? 'shared';

    if (
      mode === 'shared' &&
      this.#sharedInstance &&
      !this.#sharedInstance.released
    ) {
      throw new ThrexusError(
        'ASSET_STATE',
        'GltfAsset shared mode allows only one active instance.',
      );
    }

    this.#hooks.retain();

    let root: Object3D;
    if (mode === 'shared') {
      root = this.#source.scene;
    } else if (mode === 'skeleton-clone') {
      root = skeletonCloneObject(this.#source.scene);
    } else {
      root = this.#source.scene.clone(true);
    }

    let ownedMaterials: ReturnType<typeof cloneMaterialsOnObject>['materials'] =
      [];
    let ownedTextures: ReturnType<typeof cloneMaterialsOnObject>['textures'] =
      [];

    if (materials === 'clone' && mode !== 'shared') {
      const owned = cloneMaterialsOnObject(root, textures);
      ownedMaterials = owned.materials;
      ownedTextures = owned.textures;
    }

    const instance = new ManagedGltfInstance(
      root,
      ownedMaterials,
      ownedTextures,
      () => this.#hooks?.release(),
      mode === 'shared'
        ? () => {
            this.#sharedInstance = undefined;
          }
        : undefined,
    );

    if (mode === 'shared') {
      this.#sharedInstance = instance;
    }

    return instance;
  }

  /** AssetManager 释放缓存条目时调用：销毁共享 GPU 资源。 */
  disposeShared(): void {
    if (this.#sharedDisposed) {
      return;
    }
    this.#sharedDisposed = true;
    this.#sharedInstance = undefined;
    disposeSharedResources(this.#shared);
  }
}

function resolveTreeMode(
  scene: Object3D,
  options: GltfInstantiateOptions,
): 'clone' | 'skeleton-clone' | 'shared' {
  if (options.mode === 'shared') {
    return 'shared';
  }

  const skeleton = options.skeleton ?? options.mode ?? 'auto';
  if (skeleton === 'clone') {
    return 'clone';
  }
  if (skeleton === 'skeleton-clone') {
    return 'skeleton-clone';
  }
  return hasSkinnedMesh(scene) ? 'skeleton-clone' : 'clone';
}
