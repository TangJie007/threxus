import {
  Bone,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Texture,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GltfAsset,
  ThrexusError,
  createAssetManager,
  createDeferredTestLoader,
  type AssetManager,
} from '../../src';

function createTexturedMesh(): Mesh {
  const geometry = new BoxGeometry();
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  return new Mesh(geometry, material);
}

function createSkinnedDemo(): Object3D {
  const root = new Group();
  const bone = new Bone();
  const skeleton = new Skeleton([bone]);
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new SkinnedMesh(geometry, material);
  mesh.add(bone);
  mesh.bind(skeleton);
  root.add(mesh);
  return root;
}

function registerGltfTestLoader(assets: AssetManager) {
  const loader = createDeferredTestLoader<GltfAsset>('gltf');
  loader.dispose = (asset) => {
    asset.disposeShared();
  };
  assets.registerLoader(loader);
  return loader;
}

describe('GltfAsset / M7', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows two clones under different parents without sharing the same root', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = registerGltfTestLoader(assets);

    const scene = new Group();
    scene.add(createTexturedMesh());
    const pending = assets.acquireGLTF('/model.glb');
    loader.resolve(new GltfAsset({ scene }));
    const handle = await pending;

    const parentA = new Group();
    const parentB = new Group();
    const a = handle.value.instantiate({ mode: 'clone' });
    const b = handle.value.instantiate({ mode: 'clone' });
    parentA.add(a.root);
    parentB.add(b.root);

    expect(a.root).not.toBe(b.root);
    expect(a.root).not.toBe(scene);
    expect(parentA.children).toContain(a.root);
    expect(parentB.children).toContain(b.root);

    const meshA = a.root.children[0] as Mesh;
    const meshB = b.root.children[0] as Mesh;
    expect(meshA.geometry).toBe(meshB.geometry);
    expect(meshA.material).toBe(meshB.material);

    a.dispose();
    b.dispose();
    handle.dispose();
    await flush();
    await assets.dispose();
  });

  it('does not dispose shared geometry/material when instance is released', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = registerGltfTestLoader(assets);

    const mesh = createTexturedMesh();
    const geometry = mesh.geometry;
    const material = mesh.material as MeshStandardMaterial;
    const scene = new Group();
    scene.add(mesh);

    const pending = assets.acquireGLTF('/model.glb');
    loader.resolve(new GltfAsset({ scene }));
    const handle = await pending;

    const instance = handle.value.instantiate({ mode: 'clone' });
    const geoDispose = vi.spyOn(geometry, 'dispose');
    const matDispose = vi.spyOn(material, 'dispose');

    instance.dispose();
    expect(geoDispose).not.toHaveBeenCalled();
    expect(matDispose).not.toHaveBeenCalled();

    handle.dispose();
    await flush();
    expect(geoDispose).toHaveBeenCalled();
    expect(matDispose).toHaveBeenCalled();

    await assets.dispose();
  });

  it('disposes cloned materials but not shared textures', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = registerGltfTestLoader(assets);

    const mesh = createTexturedMesh();
    const texture = (mesh.material as MeshStandardMaterial).map!;
    const scene = new Group();
    scene.add(mesh);

    const pending = assets.acquireGLTF('/model.glb');
    loader.resolve(new GltfAsset({ scene }));
    const handle = await pending;

    const instance = handle.value.instantiate({
      mode: 'clone',
      materials: 'clone',
      textures: 'shared',
    });
    const instanceMesh = instance.root.children[0] as Mesh;
    const clonedMat = instanceMesh.material as MeshStandardMaterial;

    expect(clonedMat).not.toBe(mesh.material);
    expect(clonedMat.map).toBe(texture);

    const matDispose = vi.spyOn(clonedMat, 'dispose');
    const texDispose = vi.spyOn(texture, 'dispose');

    instance.dispose();
    expect(matDispose).toHaveBeenCalled();
    expect(texDispose).not.toHaveBeenCalled();

    handle.dispose();
    await flush();
    expect(texDispose).toHaveBeenCalled();

    await assets.dispose();
  });

  it('keeps shared GPU alive while instance outlives the handle', async () => {
    vi.useFakeTimers();
    const assets = createAssetManager({ releaseDelayMs: 100 });
    const loader = registerGltfTestLoader(assets);

    const mesh = createTexturedMesh();
    const geometry = mesh.geometry;
    const scene = new Group();
    scene.add(mesh);

    const pending = assets.acquireGLTF('/model.glb');
    loader.resolve(new GltfAsset({ scene }));
    const handle = await pending;

    const instance = handle.value.instantiate({ mode: 'clone' });
    const geoDispose = vi.spyOn(geometry, 'dispose');

    handle.dispose();
    await vi.advanceTimersByTimeAsync(200);
    expect(geoDispose).not.toHaveBeenCalled();
    expect(assets.inspect().totalRefs).toBeGreaterThan(0);

    instance.dispose();
    await vi.advanceTimersByTimeAsync(200);
    expect(geoDispose).toHaveBeenCalled();

    await assets.dispose();
  });

  it('rejects a second shared-mode instance', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = registerGltfTestLoader(assets);

    const scene = new Group();
    scene.add(createTexturedMesh());
    const pending = assets.acquireGLTF('/model.glb');
    loader.resolve(new GltfAsset({ scene }));
    const handle = await pending;

    const first = handle.value.instantiate({ mode: 'shared' });
    expect(() => handle.value.instantiate({ mode: 'shared' })).toThrow(
      ThrexusError,
    );

    first.dispose();
    const second = handle.value.instantiate({ mode: 'shared' });
    expect(second.root).toBe(scene);

    second.dispose();
    handle.dispose();
    await assets.dispose();
  });

  it('uses skeleton-clone for skinned meshes in auto mode', async () => {
    const assets = createAssetManager({ releaseDelayMs: 0 });
    const loader = registerGltfTestLoader(assets);

    const scene = createSkinnedDemo();
    const pending = assets.acquireGLTF('/skinned.glb');
    loader.resolve(new GltfAsset({ scene }));
    const handle = await pending;

    const a = handle.value.instantiate();
    const b = handle.value.instantiate();

    const skinnedA = findSkinned(a.root);
    const skinnedB = findSkinned(b.root);
    expect(skinnedA).toBeTruthy();
    expect(skinnedB).toBeTruthy();
    expect(skinnedA!.skeleton).not.toBe(skinnedB!.skeleton);

    a.dispose();
    b.dispose();
    handle.dispose();
    await assets.dispose();
  });
});

function findSkinned(root: Object3D): SkinnedMesh | undefined {
  let found: SkinnedMesh | undefined;
  root.traverse((object) => {
    if ((object as SkinnedMesh).isSkinnedMesh) {
      found = object as SkinnedMesh;
    }
  });
  return found;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
