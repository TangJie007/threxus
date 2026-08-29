/**
 * 创建 RenderingRuntime（Scene / Camera / Renderer / Resize / Pipeline）。
 */

import type { Camera } from 'three';
import { RenderingRuntime } from '../../rendering/RenderingRuntime';
import type { Ownership } from '../../rendering/types';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';

export interface PendingCamera {
  readonly camera: Camera;
  readonly ownership: Ownership;
}

export function createRenderingSubsystem(
  options: ThreeAppOptions,
  pendingCamera?: PendingCamera,
): RenderingRuntime {
  const rendering = new RenderingRuntime({
    canvas: options.canvas,
    ...(options.scene !== undefined ? { scene: options.scene } : {}),
    ...(options.camera !== undefined ? { camera: options.camera } : {}),
    ...(options.renderer !== undefined ? { renderer: options.renderer } : {}),
    ...(options.pixelRatio !== undefined
      ? { pixelRatio: options.pixelRatio }
      : {}),
    ...(options.resize !== undefined ? { resize: options.resize } : {}),
  });

  if (pendingCamera) {
    rendering.setCamera(pendingCamera.camera, pendingCamera.ownership);
  }

  return rendering;
}
