import type { CameraOptions } from '@threxus/runtime';

/** 立方体演示场景配置。 */
export const cubeSceneConfig = {
  background: '#0b1220',
  boxColor: 0x409eff,
  lightColor: 0xffffff,
  lightIntensity: 2,
  lightPosition: [3, 4, 5] as const,
  rotationSpeed: 1,
} as const;

export const cubeCamera: CameraOptions = {
  type: 'perspective',
  position: [2, 2, 4],
  target: [0, 0, 0],
};
