/**
 * GLTFLoader 适配为 AssetLoader&lt;GltfAsset&gt;。
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetLoader, AssetLoadContext } from '../AssetLoader';
import { GltfAsset, type GltfSource } from './GltfAsset';

export function createGltfAssetLoader(): AssetLoader<GltfAsset> {
  const loader = new GLTFLoader();

  return {
    type: 'gltf',
    load(source, _options, context) {
      return loadGltf(loader, source, context).then(
        (gltf) => new GltfAsset(gltf as GltfSource),
      );
    },
    dispose(asset) {
      asset.disposeShared();
    },
  };
}

function loadGltf(
  loader: GLTFLoader,
  source: string,
  context: AssetLoadContext,
): Promise<GltfSource> {
  return new Promise((resolve, reject) => {
    if (context.signal.aborted) {
      reject(context.signal.reason);
      return;
    }

    let settled = false;

    const onAbort = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(context.signal.reason);
    };

    context.signal.addEventListener('abort', onAbort, { once: true });

    loader.load(
      source,
      (gltf) => {
        if (settled) {
          return;
        }
        settled = true;
        context.signal.removeEventListener('abort', onAbort);
        resolve(gltf);
      },
      undefined,
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        context.signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
