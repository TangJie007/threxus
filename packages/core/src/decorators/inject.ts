/**
 * `@Inject`：字段级注入（推荐主路径）。
 */

import { writeFieldInjectMetadata } from '../metadata';
import { invalidDecoratorTargetError } from '../errors';
import type { InjectionToken } from '../types';

/**
 * 字段装饰器：声明该字段应由容器按令牌解析并赋值。
 *
 * 赋值时机：类构造完成之后。
 * Token 可以是 `createToken()` 的结果，也可以是类构造函数本身（如 `Scene`）。
 *
 * @param token - 字段对应的注入令牌
 * @returns Stage 3 字段装饰器
 *
 * @example
 * ```ts
 * @Injectable()
 * class OrbitFeature {
 *   @Inject(SceneService)
 *   scenes!: SceneService;
 *
 *   @Inject(CLOCK)
 *   clock!: Clock;
 * }
 * ```
 */
export function Inject(token: InjectionToken) {
  return (_value: undefined, context: ClassFieldDecoratorContext): void => {
    if (context.kind !== 'field') {
      throw invalidDecoratorTargetError('@Inject()', '装饰类字段');
    }

    writeFieldInjectMetadata(context, token);
  };
}
