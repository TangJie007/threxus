/**
 * 可选模块：场景序列化 / 反序列化 + 可撤销命令。
 */

import { Module } from '@threxus/core';
import { CommandService, SerializeService } from '../services';
import { ThreeCoreModule } from './core-module';

@Module({
  imports: [ThreeCoreModule],
  providers: [SerializeService, CommandService],
  exports: [SerializeService, CommandService],
})
export class ThreeSerializeModule {}
