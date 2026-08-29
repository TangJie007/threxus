import type { CameraOptions } from '@threxus/runtime';

/** 立方体演示场景配置。 */
export const cubeSceneConfig = {
  background: '#0b1220',
  lightColor: 0xffffff,
  lightIntensity: 2,
  lightPosition: [3, 4, 5] as const,
} as const;

/** M6：public/textures/checker.png */
export const cubeTextureUrl = '/textures/checker.png';

/** M7：public/models/demo-box.gltf */
export const cubeGltfUrl = '/models/german_sdkfz222.glb';

/** M6 贴图立方体（程序化 BoxGeometry）。 */
export const cubeBoxes = [
  {
    position: [-1.6, 0.8, 0] as const,
    color: 0x409eff,
    rotation: [0.2, 0.4, 0] as const,
    size: 0.55,
    spinSpeed: 1,
  },
  {
    position: [1.6, 0.8, 0] as const,
    color: 0x67c23a,
    rotation: [0.5, 1.1, 0.2] as const,
    size: 0.55,
    spinSpeed: 0.7,
  },
] as const;

/** M7 GLTF 实例摆放。 */
export const cubeGltfInstances = [
  {
    position: [-0.85, -0.35, 0] as const,
    rotation: [0.15, 0.4, 0] as const,
    scale: 0.9,
    spinSpeed: 0.8,
  },
  {
    position: [0.85, -0.35, 0] as const,
    rotation: [0.2, 1.2, 0.1] as const,
    scale: 1.1,
    spinSpeed: 1.2,
  },
] as const;

export const cubeCamera: CameraOptions = {
  type: 'perspective',
  position: [3.2, 2.4, 5.2],
  target: [0, 0, 0],
};
