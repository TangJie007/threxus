/**
 * 根据 ThreeAppOptions 创建 AssetManager，并注册默认 / 自定义 Loader。
 */

import {
  createAssetManager,
  createCubeTextureAssetLoader,
  createEnvironmentMapAssetLoader,
  createFileAssetLoader,
  createGltfAssetLoader,
  createRendererBinding,
  createTextureAssetLoader,
  type AssetManager,
  type RendererBinding,
} from '../../assets';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';

export interface AppAssetsBundle {
  readonly assets: AssetManager;
  readonly rendererBinding: RendererBinding;
  disposeLoaders(): void;
}

export function createAppAssets(options: ThreeAppOptions): AppAssetsBundle {
  const assetOptions = options.assets;
  const assets = createAssetManager({
    ...(assetOptions?.releaseDelayMs !== undefined
      ? { releaseDelayMs: assetOptions.releaseDelayMs }
      : {}),
    ...(assetOptions?.failureBackoffMs !== undefined
      ? { failureBackoffMs: assetOptions.failureBackoffMs }
      : {}),
    ...(assetOptions?.baseURI !== undefined
      ? { baseURI: assetOptions.baseURI }
      : {}),
  });

  const rendererBinding = createRendererBinding();
  const loaderDisposers: Array<() => void> = [];

  const registerDefaults = assetOptions?.registerDefaultLoaders !== false;
  if (registerDefaults) {
    assets.registerLoader(createTextureAssetLoader());
    assets.registerLoader(createCubeTextureAssetLoader());
    assets.registerLoader(createFileAssetLoader());

    const gltfLoader = createGltfAssetLoader({
      rendererBinding,
      ...(assetOptions?.gltf?.dracoPath !== undefined
        ? { dracoPath: assetOptions.gltf.dracoPath }
        : {}),
      ...(assetOptions?.gltf?.ktx2Path !== undefined
        ? { ktx2Path: assetOptions.gltf.ktx2Path }
        : {}),
      ...(assetOptions?.gltf?.meshopt !== undefined
        ? { meshopt: assetOptions.gltf.meshopt }
        : {}),
    });
    assets.registerLoader(gltfLoader);
    loaderDisposers.push(() => gltfLoader.disposeLoader());

    const envLoader = createEnvironmentMapAssetLoader({ rendererBinding });
    assets.registerLoader(envLoader);
    loaderDisposers.push(() => envLoader.disposeLoader());
  }

  for (const loader of assetOptions?.loaders ?? []) {
    assets.registerLoader(loader);
  }

  return {
    assets,
    rendererBinding,
    disposeLoaders() {
      for (const dispose of loaderDisposers.splice(0)) {
        dispose();
      }
    },
  };
}
