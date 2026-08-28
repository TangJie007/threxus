/**
 * 旋转立方体功能模块：Feature（DI）+ Component（行为）。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingFeature } from './rotating.feature';

@Module({
  imports: [ThreeCoreModule],
  providers: [RotatingFeature],
  exports: [RotatingFeature],
})
export class RotatingModule {}
