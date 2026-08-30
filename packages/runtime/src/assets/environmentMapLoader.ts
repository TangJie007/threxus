/**
 * HDR / 等距柱状环境贴图 → PMREM 预卷积。
 *
 * 产出可用于 `scene.environment` 的 Texture；dispose 时释放 PMREM 结果。
 */

import {
  EquirectangularReflectionMapping,
  PMREMGenerator,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { AssetLoader, AssetLoadContext } from './AssetLoader';
import type { RendererBinding } from './RendererBinding';

export interface EnvironmentMapLoaderOptions {
  readonly getRenderer?: () => WebGLRenderer | undefined;
  readonly rendererBinding?: RendererBinding;
  /** PMREM fromEquirectangular 的额外 blur；默认由 three 处理。 */
  readonly sigma?: number;
}

export interface EnvironmentMapAssetLoader extends AssetLoader<Texture> {
  disposeLoader(): void;
}

export function createEnvironmentMapAssetLoader(
  options: EnvironmentMapLoaderOptions = {},
): EnvironmentMapAssetLoader {
  const hdrLoader = new HDRLoader();
  let pmrem: PMREMGenerator | undefined;

  const resolveRenderer = (): WebGLRenderer => {
    const renderer =
      options.getRenderer?.() ?? options.rendererBinding?.current;
    if (!renderer) {
      throw new Error(
        'environment-map requires a WebGLRenderer. Call start() before acquireEnvironmentMap().',
      );
    }
    return renderer;
  };

  const ensurePmrem = (renderer: WebGLRenderer): PMREMGenerator => {
    if (!pmrem) {
      pmrem = new PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
    }
    return pmrem;
  };

  return {
    type: 'environment-map',
    async load(source, _loaderOptions, context) {
      const renderer = resolveRenderer();
      const generator = ensurePmrem(renderer);
      const hdr = await loadHdr(hdrLoader, source, context);
      hdr.mapping = EquirectangularReflectionMapping;
      const envMap = generator.fromEquirectangular(hdr).texture;
      hdr.dispose();
      return envMap;
    },
    dispose(texture) {
      texture.dispose();
    },
    disposeLoader() {
      pmrem?.dispose();
      pmrem = undefined;
    },
  };
}

function loadHdr(
  loader: HDRLoader,
  source: string,
  context: AssetLoadContext,
): Promise<Texture> {
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
      (texture) => {
        if (settled) {
          return;
        }
        settled = true;
        context.signal.removeEventListener('abort', onAbort);
        resolve(texture);
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
