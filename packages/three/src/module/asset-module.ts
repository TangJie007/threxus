/**
 * 可选模块：资源加载 + 运行时配置。
 */

import { Module } from '@threxus/core';
import { AssetService, ConfigService } from '../services';
import { ThreeCoreModule } from './core-module';

@Module({
  imports: [ThreeCoreModule],
  providers: [AssetService, ConfigService],
  exports: [AssetService, ConfigService],
})
export class ThreeAssetModule {}
