import type { CameraOptions } from '@threxus/runtime';

/** 无可见 WebGL 场景的演示页仍需要 canvas 挂载点。 */
export const demoCamera: CameraOptions = {
  type: 'perspective',
  position: [2, 2, 4],
  target: [0, 0, 0],
};
