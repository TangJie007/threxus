/**
 * 示例 Three 根模块：框架核心 + 视口配置 + 功能模块。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule, THREE_VIEWPORT } from '@threxus/three';
import { RotatingModule } from './rotating/rotating.module';

@Module({
  imports: [
    ThreeCoreModule, 
    RotatingModule
  ],
  providers: [
    {
      provide: THREE_VIEWPORT,
      useValue: {
        position: [0, 0.6, 5],
        lookAt: [0, 0, 0],
      },
    },
  ],
})
export class ThreeAppModule {}
