import {
  OrthographicCamera,
  PerspectiveCamera,
  type Camera,
} from 'three';
import { applyCameraTransform } from './math';
import type {
  CameraOptions,
  CameraSource,
  OrthographicCameraOptions,
  PerspectiveCameraOptions,
  ResolvedCoreObject,
} from './types';

const DEFAULT_PERSPECTIVE: PerspectiveCameraOptions = {
  type: 'perspective',
  fov: 50,
  near: 0.1,
  far: 1_000,
  position: [0, 0, 5],
};

export function resolveCamera(
  source: CameraSource,
  aspect = 1,
): ResolvedCoreObject<Camera> {
  if (isCameraInstance(source)) {
    return { value: source, ownership: 'external' };
  }

  const options = source ?? DEFAULT_PERSPECTIVE;
  if (options.type === 'orthographic') {
    return {
      value: createOrthographicCamera(options, aspect),
      ownership: 'app',
    };
  }

  return {
    value: createPerspectiveCamera(options, aspect),
    ownership: 'app',
  };
}

export function createPerspectiveCamera(
  options: PerspectiveCameraOptions,
  aspect: number,
): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    options.fov ?? 50,
    aspect,
    options.near ?? 0.1,
    options.far ?? 1_000,
  );
  applyCameraTransform(camera, options);
  camera.updateProjectionMatrix();
  return camera;
}

export function createOrthographicCamera(
  options: OrthographicCameraOptions,
  aspect: number,
): OrthographicCamera {
  const frustumSize = options.frustumSize ?? 10;
  const halfWidth = (frustumSize * aspect) / 2;
  const halfHeight = frustumSize / 2;
  const camera = new OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    options.near ?? 0.1,
    options.far ?? 1_000,
  );
  camera.zoom = options.zoom ?? 1;
  applyCameraTransform(camera, options);
  camera.updateProjectionMatrix();
  return camera;
}

function isCameraInstance(source: CameraSource): source is Camera {
  return (
    source !== undefined &&
    typeof source === 'object' &&
    'isCamera' in source &&
    (source as Camera).isCamera === true
  );
}

export type { CameraOptions };
