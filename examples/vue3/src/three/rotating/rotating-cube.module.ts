/**
 * 旋转立方体业务模块。
 */
import { ThreeCoreModule } from '@threxus/three';
import { Module, } from '@threxus/core';
import { RotatingCubeSystem } from './rotating-cube.system';

@Module({
  imports: [ThreeCoreModule],
  providers: [RotatingCubeSystem],
  exports: [RotatingCubeSystem],
})
export class RotatingCubeModule {}
