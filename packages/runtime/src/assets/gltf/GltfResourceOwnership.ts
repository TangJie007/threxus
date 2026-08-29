/**
 * GLTF 共享 / 实例私有 GPU 资源收集与释放。
 */

import type {
  BufferGeometry,
  Material,
  Object3D,
  Texture,
} from 'three';
import {
  Mesh,
  SkinnedMesh,
} from 'three';

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'bumpMap',
  'displacementMap',
  'roughnessMap',
  'metalnessMap',
  'alphaMap',
  'aoMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'specularMap',
] as const;

export interface SharedGltfResources {
  readonly geometries: Set<BufferGeometry>;
  readonly materials: Set<Material>;
  readonly textures: Set<Texture>;
}

export function collectSharedResources(root: Object3D): SharedGltfResources {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) {
      return;
    }
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    for (const material of normalizeMaterials(mesh.material)) {
      materials.add(material);
      collectTextures(material, textures);
    }
  });

  return { geometries, materials, textures };
}

export function disposeSharedResources(resources: SharedGltfResources): void {
  for (const geometry of resources.geometries) {
    geometry.dispose();
  }
  for (const material of resources.materials) {
    material.dispose();
  }
  for (const texture of resources.textures) {
    texture.dispose();
  }
}

export function hasSkinnedMesh(root: Object3D): boolean {
  let found = false;
  root.traverse((object) => {
    if ((object as SkinnedMesh).isSkinnedMesh) {
      found = true;
    }
  });
  return found;
}

/**
 * 为实例克隆材质；默认仍共享 Texture。
 * 返回实例拥有的 Material / Texture，dispose 时只释放这些。
 */
export function cloneMaterialsOnObject(
  root: Object3D,
  textures: 'shared' | 'clone',
): { materials: Material[]; textures: Texture[] } {
  const ownedMaterials: Material[] = [];
  const ownedTextures: Texture[] = [];
  const materialMap = new Map<Material, Material>();

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) =>
        cloneOneMaterial(material, textures, materialMap, ownedMaterials, ownedTextures),
      );
    } else if (mesh.material) {
      mesh.material = cloneOneMaterial(
        mesh.material,
        textures,
        materialMap,
        ownedMaterials,
        ownedTextures,
      );
    }
  });

  return { materials: ownedMaterials, textures: ownedTextures };
}

export function disposeOwnedInstanceResources(
  materials: readonly Material[],
  textures: readonly Texture[],
): void {
  for (const material of materials) {
    material.dispose();
  }
  for (const texture of textures) {
    texture.dispose();
  }
}

function cloneOneMaterial(
  material: Material,
  textures: 'shared' | 'clone',
  cache: Map<Material, Material>,
  ownedMaterials: Material[],
  ownedTextures: Texture[],
): Material {
  const cached = cache.get(material);
  if (cached) {
    return cached;
  }

  const cloned = material.clone();
  cache.set(material, cloned);
  ownedMaterials.push(cloned);

  if (textures === 'clone') {
    cloneMaterialTextures(cloned, ownedTextures);
  }

  return cloned;
}

function cloneMaterialTextures(
  material: Material,
  ownedTextures: Texture[],
): void {
  const record = material as Material & Record<string, unknown>;
  for (const key of TEXTURE_KEYS) {
    const value = record[key];
    if (value && typeof value === 'object' && 'isTexture' in value) {
      const texture = value as Texture;
      const cloned = texture.clone();
      cloned.needsUpdate = true;
      record[key] = cloned;
      ownedTextures.push(cloned);
    }
  }
}

function collectTextures(material: Material, textures: Set<Texture>): void {
  const record = material as Material & Record<string, unknown>;
  for (const key of TEXTURE_KEYS) {
    const value = record[key];
    if (value && typeof value === 'object' && 'isTexture' in value) {
      textures.add(value as Texture);
    }
  }
}

function normalizeMaterials(
  material: Material | Material[],
): Material[] {
  return Array.isArray(material) ? material : material ? [material] : [];
}
