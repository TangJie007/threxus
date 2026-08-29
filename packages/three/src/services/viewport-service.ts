/**
 * 视口装配：按 {@link THREE_VIEWPORT} 配置主相机位姿 / fov。
 *
 * 与业务 Feature 分离，避免功能模块里摆相机。
 */

import { Inject, Injectable, type OnModuleInit } from '@threxus/core';
import { THREE_VIEWPORT, type ViewportOptions } from '../tokens';
import { CameraService } from './camera-service';

@Injectable()
export class ViewportService implements OnModuleInit {
  @Inject(CameraService)
  cameras!: CameraService;

  @Inject(THREE_VIEWPORT)
  options!: ViewportOptions;

  onModuleInit(): void {
    const camera = this.cameras.active;
    const { position, lookAt, fov } = this.options;

    if (fov != null) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (position) {
      camera.position.set(...position);
    }
    if (lookAt) {
      camera.lookAt(...lookAt);
    }
  }
}
