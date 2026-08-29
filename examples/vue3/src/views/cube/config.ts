import type { CameraOptions } from '@threxus/runtime';

/** 立方体演示场景配置。 */
export const cubeSceneConfig = {
  background: '#0b1220',
  lightColor: 0xffffff,
  lightIntensity: 2,
  lightPosition: [3, 4, 5] as const,
} as const;

/** M6：public/textures/checker.png，经 AssetManager 加载。 */
export const cubeTextureUrl = '/textures/checker.png';

/** 多个立方体：位置 / 颜色 / 初始旋转 / 尺寸 / 自转速度。 */
export const cubeBoxes = [
  {
    position: [-1.4, 0, 0] as const,
    color: 0x409eff,
    rotation: [0.2, 0.4, 0] as const,
    size: 0.8,
    spinSpeed: 1,
  },
  {
    position: [0, 0.3, 0] as const,
    color: 0x67c23a,
    rotation: [0.5, 1.1, 0.2] as const,
    size: 1,
    spinSpeed: 0.6,
  },
  {
    position: [1.5, -0.2, 0.2] as const,
    color: 0xe6a23c,
    rotation: [0, 2.2, 0.4] as const,
    size: 1.2,
    spinSpeed: 1.4,
  },
] as const;

export const cubeCamera: CameraOptions = {
  type: 'perspective',
  position: [3, 2.5, 5],
  target: [0, 0, 0],
};
