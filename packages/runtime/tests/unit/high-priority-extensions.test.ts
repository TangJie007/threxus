import { Group, Mesh, MeshBasicMaterial, BoxGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PICK_ID_KEY,
  markPickable,
  resolvePickTarget,
  createGltfAssetLoader,
  createEnvironmentMapAssetLoader,
  createRendererBinding,
} from '../../src';

describe('pickTarget helpers', () => {
  it('returns self when no pickId is set', () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    expect(resolvePickTarget(mesh)).toBe(mesh);
  });

  it('walks up to pickId ancestor', () => {
    const root = markPickable(new Group(), 'device-1');
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    root.add(mesh);
    expect(resolvePickTarget(mesh)).toBe(root);
    expect(root.userData[DEFAULT_PICK_ID_KEY]).toBe('device-1');
  });
});

describe('compressed / environment loaders', () => {
  it('createGltfAssetLoader exposes disposeLoader and gltf type', () => {
    const loader = createGltfAssetLoader({ meshopt: true });
    expect(loader.type).toBe('gltf');
    expect(() => loader.disposeLoader()).not.toThrow();
  });

  it('createEnvironmentMapAssetLoader requires bound renderer', async () => {
    const binding = createRendererBinding();
    const loader = createEnvironmentMapAssetLoader({ rendererBinding: binding });
    expect(loader.type).toBe('environment-map');
    await expect(
      loader.load('env.hdr', undefined, {
        signal: new AbortController().signal,
        key: {
          type: 'environment-map',
          source: 'env.hdr',
          variant: undefined,
          paramsKey: '',
          cacheKey: 'environment-map|env.hdr',
        },
      }),
    ).rejects.toThrow(/WebGLRenderer/);
    loader.disposeLoader();
  });
});
