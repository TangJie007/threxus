/**
 * 旋转立方体功能模块：System（能力）+ View（编排）。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingSystem } from './rotating.system';
import { RotatingView } from './rotating.view';

@Module({
  imports: [ThreeCoreModule],
  providers: [RotatingSystem, RotatingView],
  exports: [RotatingSystem],
})
export class RotatingModule {}
