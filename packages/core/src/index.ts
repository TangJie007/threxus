/**
 * 公共入口：对外导出 DI 壳子的全部 API。
 *
 * 使用方可只从 `@threxus/core` 导入，无需关心内部目录划分。
 */

export { createToken, type Token } from './token';
export { Injectable, Inject } from './decorators';
export { Module, loadModule, getProviderToken } from './module';
export type { LoadedModule, ModuleHost, ModuleMetadata, ModuleOptions } from './module';
export { Container, createContainer } from './container';
export {
  THREXUS_METADATA,
  readClassMetadata,
  readModuleMetadata,
  isModule,
} from './metadata';
export type {
  ClassMetadata,
  Constructor,
  FieldInjection,
  InjectableOptions,
  InjectionToken,
  Provider,
} from './types';
