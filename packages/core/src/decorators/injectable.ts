/**
 * `@Injectable`：标记可注入类；可选声明构造函数依赖（辅路径）。
 */

import { writeInjectableMetadata } from '../metadata';
import { invalidDecoratorTargetError } from '../errors';
import type { InjectableOptions } from '../types';

/**
 * 类装饰器：标记该类可由容器实例化。
 *
 * 日常依赖推荐字段 `@Inject(token)`。
 * 若构造函数需要参数，再用 `inject` 按顺序声明令牌。
 *
 * @param options - 可注入配置；省略或空 `inject` 表示无构造依赖
 * @returns Stage 3 类装饰器
 *
 * @example
 * ```ts
 * @Injectable()
 * class OrbitSystem {
 *   @Inject(Scene)
 *   scene: Scene;
 * }
 *
 * @Injectable({ inject: [CLOCK] })
 * class Ticker {
 *   constructor(readonly clock: Clock) {}
 * }
 * ```
 */
export function Injectable(options: InjectableOptions = {}) {
  return <Class extends abstract new (...args: any[]) => unknown>(
    _value: Class,
    context: ClassDecoratorContext<Class>,
  ): void => {
    if (context.kind !== 'class') {
      throw invalidDecoratorTargetError('@Injectable()', '装饰类');
    }

    writeInjectableMetadata(context, options.inject ?? []);
  };
}
