/**
 * 旋转立方体功能模块：Entity（普通 class）+ Feature（DI）+ Component（行为）。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingFeature } from './rotating.system';

@Module({
  imports: [ThreeCoreModule],
  providers: [RotatingFeature],
  exports: [RotatingFeature],
})
export class RotatingModule {}
