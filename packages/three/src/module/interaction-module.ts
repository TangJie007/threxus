/**
 * 可选模块：拾取交互 + 选中集合。
 */

import { Module } from '@threxus/core';
import { InteractionService, SelectionService } from '../services';
import { ThreeCoreModule } from './core-module';

@Module({
  imports: [ThreeCoreModule],
  providers: [SelectionService, InteractionService],
  exports: [SelectionService, InteractionService],
})
export class ThreeInteractionModule {}
