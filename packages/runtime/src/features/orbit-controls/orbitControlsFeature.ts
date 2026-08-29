/**
 * OrbitControls Feature：创建控件、每帧 update、Camera 替换同步、按需 invalidate。
 */

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import {
  CameraControlService,
  type CameraControlService as CameraControlServiceType,
} from './CameraControlService';

export interface OrbitControlsFeatureOptions {
  readonly damping?: boolean;
  readonly dampingFactor?: number;
  readonly target?: readonly [number, number, number];
  readonly enablePan?: boolean;
  readonly enableZoom?: boolean;
  readonly enableRotate?: boolean;
}

export function orbitControlsFeature(
  options: OrbitControlsFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'orbit-controls',
    provides: [CameraControlService],
    setup(context) {
      const controls = new OrbitControls(context.camera, context.canvas);
      controls.enableDamping = options.damping ?? true;
      if (options.dampingFactor !== undefined) {
        controls.dampingFactor = options.dampingFactor;
      }
      if (options.target) {
        controls.target.set(
          options.target[0],
          options.target[1],
          options.target[2],
        );
      }
      if (options.enablePan !== undefined) {
        controls.enablePan = options.enablePan;
      }
      if (options.enableZoom !== undefined) {
        controls.enableZoom = options.enableZoom;
      }
      if (options.enableRotate !== undefined) {
        controls.enableRotate = options.enableRotate;
      }
      controls.update();

      const service: CameraControlServiceType = {
        controls,
        get enabled() {
          return controls.enabled;
        },
        set enabled(value: boolean) {
          controls.enabled = value;
        },
        reset() {
          controls.reset();
        },
      };
      context.provide(CameraControlService, service);

      context.onUpdate(() => {
        controls.update();
      });

      controls.addEventListener('change', () => {
        context.invalidate();
      });

      context.onCameraChanged(({ current }) => {
        controls.object = current;
        controls.update();
      });

      context.addCleanup(() => {
        controls.dispose();
      });
    },
  };
}
