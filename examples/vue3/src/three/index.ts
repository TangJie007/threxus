/**
 * 示例 Three 根模块：ThreeCoreModule + 业务 System。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingCube } from './rotating-cube';

@Module({
  imports: [ThreeCoreModule],
  providers: [RotatingCube],
})
export class ThreeAppModule {}