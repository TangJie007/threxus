/**
 * 强类型服务标识（Token）。
 *
 * 使用 `symbol` 作为运行时唯一 id，避免字符串碰撞；
 * 使用 phantom 类型 `__type` 在编译期携带服务类型，运行时无开销。
 *
 * 每个 ServiceKey 应在模块顶层创建一次并导出，供 provide/inject 共享。
 */

/** 服务标识；`T` 仅用于 TypeScript 类型推导。 */
export interface ServiceKey<T> {
  readonly id: symbol;
  readonly description: string;
  /** 编译期类型占位，运行时不存在。 */
  readonly __type?: T;
}

/**
 * 创建一个冻结的服务标识。
 * @param description 人类可读名称，用于错误信息和调试。
 */
export function createServiceKey<T>(description: string): ServiceKey<T> {
  if (description.trim().length === 0) {
    throw new TypeError('Service key description cannot be empty.');
  }

  return Object.freeze({
    id: Symbol(description),
    description,
  });
}
