/**
 * Service 定义辅助：把强类型 Token 与单服务 provider Feature 收敛到一处。
 */

import type {
  ProvideServiceOptions,
  ThreeContext,
  ThreeFeature,
} from '../feature/ThreeFeature';
import { createServiceKey, type ServiceKey } from './ServiceKey';

export interface DefineServiceOptions<T, TOptions = void> {
  /** ServiceKey 的可读名称；默认也作为 provider Feature 名称。 */
  readonly name: string;
  /** provider Feature 名称；未提供时使用 name。 */
  readonly featureName?: string;
  readonly dependencies?: readonly ServiceKey<unknown>[];
  readonly optionalDependencies?: readonly ServiceKey<unknown>[];
  /** 服务从容器移除时的释放策略，默认 auto。 */
  readonly dispose?: ProvideServiceOptions['dispose'];
  /** 创建服务值；返回后由生成的 Feature 自动 provide。 */
  create(context: ThreeContext, options: TOptions): T | Promise<T>;
}

/**
 * defineService 的返回值本身就是 ServiceKey，可直接用于 dependencies / inject。
 */
export interface ServiceDefinition<T, TOptions = void> extends ServiceKey<T> {
  /** 为当前服务创建一个 provider Feature。 */
  feature(options?: TOptions): ThreeFeature;
}

export function defineService<T, TOptions = void>(
  options: DefineServiceOptions<T, TOptions>,
): ServiceDefinition<T, TOptions> {
  const key = createServiceKey<T>(options.name);
  const featureName = options.featureName ?? options.name;

  const definition: ServiceDefinition<T, TOptions> = {
    ...key,
    feature: (featureOptions?: TOptions): ThreeFeature => ({
      name: featureName,
      provides: [definition],
      ...(options.dependencies
        ? { dependencies: options.dependencies }
        : {}),
      ...(options.optionalDependencies
        ? { optionalDependencies: options.optionalDependencies }
        : {}),
      async setup(context) {
        const value = await options.create(
          context,
          featureOptions as TOptions,
        );
        context.provide(
          definition,
          value,
          options.dispose ? { dispose: options.dispose } : undefined,
        );
      },
    }),
  };

  return Object.freeze(definition);
}
