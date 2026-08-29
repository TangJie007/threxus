/**
 * GLTF 场景实例：挂到场景树的可释放对象。
 *
 * dispose 时：
 * - 从父节点移除 root
 * - 释放实例私有 Material / Texture
 * - 释放对父 GltfAsset 的引用
 * - 不释放共享 Geometry / 共享 Material / 共享 Texture
 */

import type { Material, Object3D, Texture } from 'three';
import type { Disposable } from '../../lifecycle/Disposable';
import { disposeOwnedInstanceResources } from './GltfResourceOwnership';

export interface GltfInstance extends Disposable {
  readonly root: Object3D;
  readonly released: boolean;
}

export class ManagedGltfInstance implements GltfInstance {
  #released = false;
  readonly #ownedMaterials: readonly Material[];
  readonly #ownedTextures: readonly Texture[];
  readonly #releaseParent: () => void;
  readonly #onDispose: (() => void) | undefined;

  constructor(
    readonly root: Object3D,
    ownedMaterials: readonly Material[],
    ownedTextures: readonly Texture[],
    releaseParent: () => void,
    onDispose?: () => void,
  ) {
    this.#ownedMaterials = ownedMaterials;
    this.#ownedTextures = ownedTextures;
    this.#releaseParent = releaseParent;
    this.#onDispose = onDispose;
  }

  get released(): boolean {
    return this.#released;
  }

  dispose(): void {
    if (this.#released) {
      return;
    }
    this.#released = true;

    this.root.removeFromParent();
    disposeOwnedInstanceResources(this.#ownedMaterials, this.#ownedTextures);
    this.#onDispose?.();
    this.#releaseParent();
  }
}
