import type { CameraOptions } from '@threxus/runtime';

/** 与 examples/test 厂区尺度对齐的相机初始位。 */
export const factoryCamera: CameraOptions = {
  type: 'perspective',
  fov: 50,
  near: 0.5,
  far: 400,
  position: [48, 28, 52],
  target: [0, 2, 0],
};

/** 巡检路径（与 test CameraRig 一致）。 */
export const factoryRoamPath = [
  [-42, 6, 30],
  [-20, 5, 26],
  [10, 7, 28],
  [38, 5, 20],
  [42, 9, -6],
  [20, 6, -26],
  [-12, 8, -28],
  [-40, 6, -8],
] as const;

export const factorySceneConfig = {
  background: '#0a0f16',
  ambientIntensity: 0.35,
  sunIntensity: 1.65,
  sunPosition: [28, 42, 18] as const,
  bounds: { width: 100, depth: 70, height: 11 },
} as const;
