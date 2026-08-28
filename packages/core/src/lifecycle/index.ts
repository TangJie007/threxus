/**
 * 生命周期模块出口。
 */

export type {
  LifecycleInstance,
  OnApplicationBootstrap,
  OnDispose,
  OnModuleInit,
  OnUpdate,
} from './hooks';
export { classHasHook, instanceHasHook } from './hooks';
