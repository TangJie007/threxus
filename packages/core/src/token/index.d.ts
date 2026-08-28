/**
 * 注入令牌（Token）定义。
 *
 * 浏览器端无法依赖 `emitDecoratorMetadata` 做类型反射，
 * 因此所有跨边界依赖都通过显式 Token 声明，以保证类型安全与可追溯性。
 */
/**
 * 带类型参数的唯一符号令牌。
 *
 * `__type` 仅用于 TypeScript 类型推断，运行时不存在该字段。
 *
 * @typeParam T - 该令牌对应的解析值类型
 */
export type Token<T> = symbol & {
    readonly __type?: T;
};
/**
 * 创建一个新的注入令牌。
 *
 * @typeParam T - 令牌解析后的值类型
 * @param description - 便于调试的描述字符串（会出现在 `symbol.description` 中）
 * @returns 可用于 `Container.set` / `get` / `@Inject` / `inject` 的令牌
 *
 * @example
 * ```ts
 * const CLOCK = createToken<{ now: () => number }>('clock');
 * ```
 */
export declare function createToken<T>(description: string): Token<T>;
