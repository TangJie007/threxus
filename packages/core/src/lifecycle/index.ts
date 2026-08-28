/**
 * 生命周期模块出口。
 */

export type {
  EntitySystem,
  LifecycleInstance,
  OnApplicationBootstrap,
  OnDispose,
  OnModuleInit,
  OnUpdate,
} from './hooks';
export { classHasHook, instanceHasHook } from './hooks';
