/**
 * Texture / CubeTexture / File 内置 Loader。
 */

import {
  CubeTexture,
  CubeTextureLoader,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import type { AssetLoader, AssetLoadContext } from './AssetLoader';

export interface TextureLoaderOptions {
  readonly colorSpace?: typeof SRGBColorSpace | string;
  readonly flipY?: boolean;
}

export function createTextureAssetLoader(): AssetLoader<
  Texture,
  TextureLoaderOptions
> {
  const loader = new TextureLoader();

  return {
    type: 'texture',
    load(source, options, context) {
      return loadWithThreeLoader(
        context,
        (onLoad, onError) => {
          loader.load(source, onLoad, undefined, onError);
        },
        (texture) => {
          if (options?.colorSpace !== undefined) {
            texture.colorSpace = options.colorSpace as Texture['colorSpace'];
          }
          if (options?.flipY !== undefined) {
            texture.flipY = options.flipY;
          }
          return texture;
        },
      );
    },
    dispose(texture) {
      texture.dispose();
    },
  };
}

export interface CubeTextureLoaderOptions {
  /** 六面路径；若提供则优先于 AssetKey.source。 */
  readonly urls?: readonly string[];
}

export function createCubeTextureAssetLoader(): AssetLoader<
  CubeTexture,
  CubeTextureLoaderOptions
> {
  const loader = new CubeTextureLoader();

  return {
    type: 'cube-texture',
    load(source, options, context) {
      const urls = options?.urls ?? parseCubeUrls(source);
      if (urls.length !== 6) {
        return Promise.reject(
          new TypeError(
            'cube-texture requires exactly 6 URLs via params.urls or source JSON array.',
          ),
        );
      }

      return loadWithThreeLoader(
        context,
        (onLoad, onError) => {
          loader.load([...urls], onLoad, undefined, onError);
        },
        (texture) => texture,
      );
    },
    dispose(texture) {
      texture.dispose();
    },
  };
}

export type FileAssetResult = ArrayBuffer | string;

export interface FileLoaderOptions {
  readonly responseType?: 'arraybuffer' | 'text';
}

export function createFileAssetLoader(): AssetLoader<
  FileAssetResult,
  FileLoaderOptions
> {
  return {
    type: 'file',
    async load(source, options, context) {
      const response = await fetch(source, { signal: context.signal });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch "${source}": ${response.status} ${response.statusText}`,
        );
      }
      if (options?.responseType === 'text') {
        return response.text();
      }
      return response.arrayBuffer();
    },
  };
}

function parseCubeUrls(source: string): string[] {
  try {
    const parsed: unknown = JSON.parse(source);
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return parsed;
    }
  } catch {
    // not JSON
  }
  return [];
}

function loadWithThreeLoader<T>(
  context: AssetLoadContext,
  start: (
    onLoad: (value: T) => void,
    onError: (error: unknown) => void,
  ) => void,
  map: (value: T) => T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
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

    start(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        context.signal.removeEventListener('abort', onAbort);
        resolve(map(value));
      },
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
