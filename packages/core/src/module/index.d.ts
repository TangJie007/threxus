/**
 * 模块系统：`@Module`、加载器与相关类型。
 */
export { Module } from './module';
export { loadModule, type LoadedModule, type ModuleHost } from './load';
export { getProviderToken, type ModuleMetadata, type ModuleOptions, } from './types';
