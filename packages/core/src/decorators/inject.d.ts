/**
 * `@Inject`：字段级注入（方案 A / 方案 C 辅路径）。
 */
import type { InjectionToken } from '../types';
/**
 * 字段装饰器：声明该字段应由容器按令牌解析并赋值。
 *
 * 赋值时机：类构造完成之后。适合偶发的跨模块依赖；
 * 主依赖仍推荐写在 `@Injectable({ inject })` 中。
 *
 * @param token - 字段对应的注入令牌
 * @returns Stage 3 字段装饰器
 *
 * @example
 * ```ts
 * @Injectable({ inject: [CLOCK] })
 * class TickerService {
 *   @Inject(LABEL)
 *   label!: string;
 *
 *   constructor(readonly clock: Clock) {}
 * }
 * ```
 */
export declare function Inject(token: InjectionToken): (_value: undefined, context: ClassFieldDecoratorContext) => void;
