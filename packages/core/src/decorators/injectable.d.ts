/**
 * `@Injectable`：标记可注入类，并声明构造函数依赖（方案 B / 方案 C 主路径）。
 */
import type { InjectableOptions } from '../types';
/**
 * 类装饰器：将 `inject` 令牌列表写入 Decorator Metadata。
 *
 * 容器实例化该类时，会按 `inject` 顺序 `get` 依赖并传入构造函数。
 * 若同时存在字段 `@Inject`，字段赋值发生在 `new` 之后。
 *
 * @param options - 可注入配置；省略时表示无构造依赖
 * @returns Stage 3 类装饰器
 *
 * @example
 * ```ts
 * @Injectable({ inject: [CLOCK, CAMERA] })
 * class OrbitSystem {
 *   constructor(
 *     readonly clock: Clock,
 *     readonly camera: Camera,
 *   ) {}
 * }
 * ```
 */
export declare function Injectable(options?: InjectableOptions): <Class extends abstract new (...args: any[]) => unknown>(_value: Class, context: ClassDecoratorContext<Class>) => void;
