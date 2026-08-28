/**
 * `@threxus/runtime` 公共出口。
 *
 * 使用方可只从包名导入，无需关心内部目录划分。
 */

export { RuntimeClock, type Clock } from './clock';
export {
  APPLICATION,
  CANVAS,
  CLOCK,
  type ApplicationRef,
} from './tokens';
export {
  RuntimeModule,
  provideRuntimeBindings,
  clearRuntimeBindings,
  type RuntimeBindings,
} from './module';
export {
  ThrexusApplication,
  createApplication,
  type ApplicationOptions,
} from './application';
