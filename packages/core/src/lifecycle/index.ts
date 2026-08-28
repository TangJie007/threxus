/**
 * 生命周期模块出口。
 */

export type {
  FeatureLifecycle,
  LifecycleInstance,
  OnApplicationBootstrap,
  OnDispose,
  OnModuleInit,
  OnUpdate,
} from './hooks';
export { classHasHook, instanceHasHook } from './hooks';
