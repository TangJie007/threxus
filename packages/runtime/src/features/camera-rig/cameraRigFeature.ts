/**
 * 相机运镜 Feature：飞向目标 + 可选巡检路径，运镜期间禁用 OrbitControls。
 */

import {
  CatmullRomCurve3,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { ThrexusError } from '../../errors';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import { createServiceKey } from '../../services/ServiceKey';
import { CameraControlService } from '../orbit-controls/CameraControlService';

export type CameraRigMode = 'orbit' | 'roam';

export interface CameraRigService {
  readonly mode: CameraRigMode;
  readonly busy: boolean;
  setMode(mode: CameraRigMode): void;
  /**
   * 平滑飞向目标。
   * @param target 看向点
   * @param options.distance 水平距离，默认 12
   * @param options.height 相对目标高度，默认 8
   * @param options.duration 秒，默认 0.9
   */
  flyTo(
    target: Vector3 | readonly [number, number, number],
    options?: {
      readonly distance?: number;
      readonly height?: number;
      readonly duration?: number;
    },
  ): void;
}

export const CameraRigService =
  createServiceKey<CameraRigService>('camera-rig');

export interface CameraRigFeatureOptions {
  /** 巡检路径控制点；不传则禁用 roam。 */
  readonly roamPath?: readonly (readonly [number, number, number])[];
  /** roam 看向点中心摆动幅度，默认 10。 */
  readonly roamLookRadius?: number;
  readonly roamSpeed?: number;
}

interface TweenState {
  from: Vector3;
  to: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  t: number;
  duration: number;
}

export function cameraRigFeature(
  options: CameraRigFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'camera-rig',
    dependencies: [CameraControlService],
    provides: [CameraRigService],
    setup(context) {
      const controls = context.inject(CameraControlService);
      const camera = context.camera as PerspectiveCamera;

      let mode: CameraRigMode = 'orbit';
      let tween: TweenState | null = null;
      let roamT = 0;
      let elapsed = 0;
      const tmp = new Vector3();
      const roamLookRadius = options.roamLookRadius ?? 10;
      const roamSpeed = options.roamSpeed ?? 0.012;

      const roamCurve =
        options.roamPath && options.roamPath.length >= 2
          ? new CatmullRomCurve3(
              options.roamPath.map(
                (p) => new Vector3(p[0], p[1], p[2]),
              ),
              true,
              'catmullrom',
              0.5,
            )
          : null;

      const nearestRoamT = (position: Vector3): number => {
        if (!roamCurve) {
          return 0;
        }
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < 100; i += 1) {
          const t = i / 100;
          const d = roamCurve.getPointAt(t, tmp).distanceToSquared(position);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
        return best;
      };

      const service: CameraRigService = {
        get mode() {
          return mode;
        },
        get busy() {
          return tween !== null || mode === 'roam';
        },
        setMode(next) {
          if (next === 'roam' && !roamCurve) {
            throw new ThrexusError(
              'APP_STATE',
              'cameraRigFeature roam mode requires options.roamPath.',
              {
                context: {
                  feature: 'camera-rig',
                  operation: 'set-mode',
                },
              },
            );
          }
          mode = next;
          if (next === 'roam') {
            controls.enabled = false;
            roamT = nearestRoamT(camera.position);
            tween = null;
          } else {
            controls.enabled = true;
            tween = null;
          }
          context.invalidate();
        },
        flyTo(target, flyOptions = {}) {
          if (mode === 'roam') {
            service.setMode('orbit');
          }
          const look =
            target instanceof Vector3
              ? target.clone()
              : new Vector3(target[0], target[1], target[2]);
          const distance = flyOptions.distance ?? 12;
          const height = flyOptions.height ?? 8;
          const duration = flyOptions.duration ?? 0.9;

          const dir = new Vector3()
            .subVectors(camera.position, controls.controls.target)
            .setY(0);
          if (dir.lengthSq() < 0.001) {
            dir.set(1, 0, 1);
          }
          dir.normalize();

          const to = new Vector3(
            look.x + dir.x * distance,
            look.y + height,
            look.z + dir.z * distance,
          );

          tween = {
            from: camera.position.clone(),
            to,
            fromTarget: controls.controls.target.clone(),
            toTarget: look,
            t: 0,
            duration,
          };
          controls.enabled = false;
          context.invalidate();
        },
      };

      context.provide(CameraRigService, service);

      context.onUpdate(({ delta }) => {
        elapsed += delta;
        if (mode === 'roam' && roamCurve) {
          roamT = (roamT + delta * roamSpeed) % 1;
          roamCurve.getPointAt(roamT, tmp);
          camera.position.copy(tmp);
          camera.lookAt(
            Math.sin(elapsed * 0.12) * roamLookRadius,
            3 + Math.sin(elapsed * 0.09) * 1.2,
            Math.cos(elapsed * 0.1) * (roamLookRadius * 0.8),
          );
          context.invalidate();
          return;
        }

        if (!tween) {
          return;
        }
        tween.t += delta;
        const k = Math.min(tween.t / tween.duration, 1);
        const e = easeInOutCubic(k);
        camera.position.lerpVectors(tween.from, tween.to, e);
        controls.controls.target.lerpVectors(
          tween.fromTarget,
          tween.toTarget,
          e,
        );
        controls.controls.update();
        if (k >= 1) {
          tween = null;
          controls.enabled = true;
        }
        context.invalidate();
      });
    },
  };
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - (Math.pow(-2 * x + 2, 3) / 2);
}
