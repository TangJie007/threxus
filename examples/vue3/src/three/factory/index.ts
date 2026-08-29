/**
 * FactoryTwin 根模块：框架核心 + 视口 + 场景 Feature（待从 examples/test 迁入）。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule, THREE_VIEWPORT } from '@threxus/three';
import { FactorySceneModule } from './factory-scene.module';

@Module({
  imports: [ThreeCoreModule, FactorySceneModule],
  providers: [
    {
      provide: THREE_VIEWPORT,
      useValue: {
        // 对齐 examples/test Viewer 的俯瞰起点，便于后续迁场景
        position: [28, 22, 32],
        lookAt: [0, 0, 0],
      },
    },
  ],
})
export class FactoryTwinModule {}
