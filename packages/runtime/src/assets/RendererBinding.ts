/**
 * 共享 Renderer 绑定：资产 Loader（KTX2 / PMREM）在 App start 后才能拿到 renderer。
 */

import type { WebGLRenderer } from 'three';
import { ThrexusError } from '../errors';

export interface RendererBinding {
  current: WebGLRenderer | undefined;
}

export function createRendererBinding(): RendererBinding {
  return { current: undefined };
}

export function requireBoundRenderer(
  binding: RendererBinding | undefined,
  purpose: string,
): WebGLRenderer {
  const renderer = binding?.current;
  if (!renderer) {
    throw new ThrexusError(
      'ASSET_STATE',
      `${purpose} requires a WebGLRenderer. Call start() before acquiring this asset, or pass getRenderer.`,
      { context: { operation: purpose } },
    );
  }
  return renderer;
}
