/**
 * Service 定义辅助：把强类型 Token 与服务创建函数组合为声明式 provider。
 */

import type { ProvideServiceOptions, ThreeContext } from '../feature/ThreeFeature';
import { createServiceKey, type ServiceKey } from './ServiceKey';

export type ServiceHandler<T> = (
  context: ThreeContext,
) => T | Promise<T>;

export interface DefineServiceOptions {
  /** 服务从容器移除时的释放策略，默认 auto。 */
  readonly dispose?: ProvideServiceOptions['dispose'];
}

/**
 * ServiceKey 与创建函数的组合。
 *
 * 定义本身兼容 ServiceKey，可直接用于 provides / dependencies / inject；
 * 当它出现在 Feature.provides 中时，运行时自动执行 handler 并注册返回值。
 */
export interface ServiceDefinition<T> extends ServiceKey<T> {
  readonly key: ServiceKey<T>;
  readonly handler: ServiceHandler<T>;
  readonly dispose?: ProvideServiceOptions['dispose'];
}

export function defineService<T>(
  name: string,
  handler: ServiceHandler<T>,
  options: DefineServiceOptions = {},
): ServiceDefinition<T> {
  const key = createServiceKey<T>(name);
  const definition: ServiceDefinition<T> = {
    ...key,
    key,
    handler,
    ...(options.dispose ? { dispose: options.dispose } : {}),
  };

  return Object.freeze(definition);
}

export function isServiceDefinition(
  value: ServiceKey<unknown>,
): value is ServiceDefinition<unknown> {
  return 'key' in value && 'handler' in value;
}
