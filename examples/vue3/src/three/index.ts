/**
 * 示例 Three 根模块：框架核心 + 功能模块。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingModule } from './rotating/rotating.module';

@Module({
  imports: [ThreeCoreModule, RotatingModule],
})
export class ThreeAppModule {}
