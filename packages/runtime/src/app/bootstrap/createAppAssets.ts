/**
 * 根据 ThreeAppOptions 创建 AssetManager，并注册默认 / 自定义 Loader。
 */

import {
  createAssetManager,
  createCubeTextureAssetLoader,
  createFileAssetLoader,
  createGltfAssetLoader,
  createTextureAssetLoader,
  type AssetManager,
} from '../../assets';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';

export function createAppAssets(options: ThreeAppOptions): AssetManager {
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

  const registerDefaults = assetOptions?.registerDefaultLoaders !== false;
  if (registerDefaults) {
    assets.registerLoader(createTextureAssetLoader());
    assets.registerLoader(createCubeTextureAssetLoader());
    assets.registerLoader(createFileAssetLoader());
    assets.registerLoader(createGltfAssetLoader());
  }
  for (const loader of assetOptions?.loaders ?? []) {
    assets.registerLoader(loader);
  }

  return assets;
}
