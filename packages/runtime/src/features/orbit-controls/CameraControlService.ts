/**
 * 相机控制服务（由 OrbitControls Feature 提供）。
 */

import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createServiceKey } from '../../services/ServiceKey';

export interface CameraControlService {
  readonly controls: OrbitControls;
  enabled: boolean;
  reset(): void;
}

export const CameraControlService =
  createServiceKey<CameraControlService>('camera-control');
