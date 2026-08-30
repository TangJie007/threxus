import type { Object3D } from 'three';
import type { AssetHandle } from '../assets/AssetHandle';
import {
  isDisposable,
  type Cleanup,
  type Disposable,
} from './Disposable';

export interface MountOptions {
  /** 场景节点的父节点；默认挂载到当前 scene。 */
  readonly parent?: Object3D;
  /**
   * GPU 资源所有权。external（默认）仅移除节点；
   * owned 会释放子树中的 geometry、material、texture 与 skeleton。
   */
  readonly gpu?: 'external' | 'owned';
}

/** 同时具有场景根节点和显式释放能力的复合资源。 */
export interface MountableResource extends Disposable {
  readonly root: Object3D;
}

/**
 * 统一绑定资源到当前生命周期：
 * - AssetHandle：retain，并返回资产值。
 * - Object3D：挂载到场景并声明所有权。
 * - MountableResource：挂载 root 并登记 dispose。
 * - 其它 Cleanup：登记清理并返回可提前释放的句柄。
 */
export interface Mount {
  <T>(resource: AssetHandle<T>): T;
  <T extends Object3D>(resource: T, options?: MountOptions): T;
  <T extends MountableResource>(resource: T, options?: MountOptions): T;
  (cleanup: Cleanup): Disposable;
}

export interface CreateMountOptions {
  readonly getDefaultParent: () => Object3D;
  readonly addCleanup: (cleanup: Cleanup) => Disposable;
  readonly own: (object: Object3D) => void;
}

export function createMount(options: CreateMountOptions): Mount {
  return ((resource: unknown, mountOptions?: MountOptions): unknown => {
    if (isAssetHandle(resource)) {
      const value = resource.value;
      options.addCleanup(resource);
      return value;
    }

    if (isObject3D(resource)) {
      (mountOptions?.parent ?? options.getDefaultParent()).add(resource);
      if (mountOptions?.gpu === 'owned') {
        options.addCleanup(() => {
          disposeOwnedObject3D(resource);
        });
      }
      options.own(resource);
      return resource;
    }

    if (isMountableResource(resource)) {
      options.addCleanup(resource);
      (mountOptions?.parent ?? options.getDefaultParent()).add(resource.root);
      options.own(resource.root);
      return resource;
    }

    if (typeof resource === 'function' || isDisposable(resource)) {
      return options.addCleanup(resource as Cleanup);
    }

    throw new TypeError(
      'mount() requires an AssetHandle, Object3D, MountableResource, or Cleanup.',
    );
  }) as Mount;
}

function isAssetHandle(value: unknown): value is AssetHandle<unknown> {
  return (
    isDisposable(value) &&
    'key' in value &&
    'released' in value &&
    'value' in value
  );
}

function isObject3D(value: unknown): value is Object3D {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isObject3D' in value &&
    value.isObject3D === true
  );
}

function isMountableResource(value: unknown): value is MountableResource {
  return (
    isDisposable(value) &&
    'root' in value &&
    isObject3D(value.root)
  );
}

/** 释放明确声明为独占的 Object3D 子树 GPU 资源。 */
export function disposeOwnedObject3D(root: Object3D): void {
  const geometries = new Set<Disposable>();
  const materials = new Set<Disposable>();
  const textures = new Set<Disposable>();
  const skeletons = new Set<Disposable>();

  root.traverse((object) => {
    const resource = object as Object3D & {
      readonly geometry?: unknown;
      readonly material?: unknown;
      readonly skeleton?: unknown;
    };
    collectDisposable(resource.geometry, geometries);
    collectMaterials(resource.material, materials, textures);
    collectDisposable(resource.skeleton, skeletons);
  });

  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

function collectMaterials(
  value: unknown,
  materials: Set<Disposable>,
  textures: Set<Disposable>,
): void {
  for (const material of Array.isArray(value) ? value : [value]) {
    if (!isDisposable(material)) continue;
    materials.add(material);

    for (const candidate of Object.values(material)) {
      collectTextures(candidate, textures);
    }
  }
}

function collectTextures(
  value: unknown,
  textures: Set<Disposable>,
  visited: WeakSet<object> = new WeakSet(),
): void {
  if (isTexture(value)) {
    textures.add(value);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectTextures(item, textures, visited);
    return;
  }
  if ('value' in value) {
    collectTextures(value.value, textures, visited);
  }
}

function isTexture(value: unknown): value is Disposable {
  return (
    isDisposable(value) &&
    'isTexture' in value &&
    value.isTexture === true
  );
}

function collectDisposable(
  value: unknown,
  target: Set<Disposable>,
): void {
  if (isDisposable(value)) target.add(value);
}
