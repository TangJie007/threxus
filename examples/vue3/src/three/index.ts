/**
 * 示例 Three 根模块：框架核心 + 业务模块。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { RotatingCubeModule } from './rotating/rotating-cube.module';

@Module({
    imports: [
        ThreeCoreModule, 
        RotatingCubeModule
    ],
})
export class ThreeAppModule {}
