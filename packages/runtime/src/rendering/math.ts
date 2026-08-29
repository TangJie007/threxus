import { Vector3 } from 'three';
import type { Vector3Like } from './types';

const scratchTarget = new Vector3();

/** 将 Vector3Like 写入 Three.js Vector3。 */
export function applyVector3Like(
  target: Vector3,
  value: Vector3Like | undefined,
): Vector3 {
  if (value === undefined) {
    return target;
  }

  if (Array.isArray(value)) {
    target.set(value[0], value[1], value[2]);
    return target;
  }

  const point = value as { readonly x: number; readonly y: number; readonly z: number };
  target.set(point.x, point.y, point.z);
  return target;
}

/** 设置相机位置并可选 lookAt 目标点。 */
export function applyCameraTransform(
  camera: { position: Vector3; lookAt: (target: Vector3) => void; updateMatrixWorld: () => void },
  options: {
    readonly position?: Vector3Like;
    readonly target?: Vector3Like;
  },
): void {
  applyVector3Like(camera.position, options.position);
  if (options.target !== undefined) {
    camera.lookAt(applyVector3Like(scratchTarget, options.target));
  }
  camera.updateMatrixWorld();
}
