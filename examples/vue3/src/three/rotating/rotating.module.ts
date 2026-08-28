/**
 * 旋转立方体功能模块：Entity（普通 class）+ System（DI）。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingSystem } from './rotating.system';

@Module({
  imports: [ThreeCoreModule],
  providers: [RotatingSystem],
  exports: [RotatingSystem],
})
export class RotatingModule {}
