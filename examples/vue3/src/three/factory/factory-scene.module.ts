/**
 * 工厂场景功能模块：承接 examples/test 中 Environment / Factory / FX 等。
 */

import { Module } from '@threxus/core';
import { ThreeCoreModule } from '@threxus/three';
import { FactorySceneFeature } from './factory-scene.feature';

@Module({
  imports: [ThreeCoreModule],
  providers: [FactorySceneFeature],
  exports: [FactorySceneFeature],
})
export class FactorySceneModule {}
