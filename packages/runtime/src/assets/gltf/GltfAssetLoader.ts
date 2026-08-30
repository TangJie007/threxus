/**
 * GLTFLoader 适配为 AssetLoader&lt;GltfAsset&gt;。
 *
 * 可选挂接 DRACO / KTX2 / Meshopt（工业模型常用压缩管线）。
 */

import type { WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { AssetLoader, AssetLoadContext } from '../AssetLoader';
import type { RendererBinding } from '../RendererBinding';
import { GltfAsset, type GltfSource } from './GltfAsset';

export interface GltfAssetLoaderOptions {
  /** DRACO 解码器目录；不传则使用 three 内置路径。 */
  readonly dracoPath?: string;
  /** KTX2/Basis 转码器目录；不传则使用 three 内置路径。 */
  readonly ktx2Path?: string;
  /** 是否启用 MeshoptDecoder，默认 true。 */
  readonly meshopt?: boolean;
  /** 为 KTX2.detectSupport 提供 renderer。 */
  readonly getRenderer?: () => WebGLRenderer | undefined;
  readonly rendererBinding?: RendererBinding;
}

export interface GltfAssetLoader extends AssetLoader<GltfAsset> {
  /** 释放 DRACO / KTX2 等附属资源。 */
  disposeLoader(): void;
}

export function createGltfAssetLoader(
  options: GltfAssetLoaderOptions = {},
): GltfAssetLoader {
  const loader = new GLTFLoader();
  const disposers: Array<() => void> = [];

  const draco = new DRACOLoader();
  if (options.dracoPath) {
    draco.setDecoderPath(options.dracoPath);
  }
  loader.setDRACOLoader(draco);
  disposers.push(() => draco.dispose());

  if (options.meshopt !== false) {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }

  let ktx2Configured = false;

  const ensureKtx2 = (): void => {
    if (ktx2Configured) {
      return;
    }

    const renderer =
      options.getRenderer?.() ?? options.rendererBinding?.current;
    if (!renderer) {
      return;
    }

    ktx2Configured = true;
    try {
      const ktx2 = new KTX2Loader().detectSupport(renderer);
      if (options.ktx2Path) {
        ktx2.setTranscoderPath(options.ktx2Path);
      }
      loader.setKTX2Loader(ktx2);
      disposers.push(() => ktx2.dispose());
    } catch {
      // KTX2 不可用时回退到未压缩纹理
    }
  };

  return {
    type: 'gltf',
    load(source, _loaderOptions, context) {
      ensureKtx2();
      return loadGltf(loader, source, context).then(
        (gltf) => new GltfAsset(gltf as GltfSource),
      );
    },
    dispose(asset) {
      asset.disposeShared();
    },
    disposeLoader() {
      for (const dispose of disposers.splice(0)) {
        dispose();
      }
      ktx2Configured = false;
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
