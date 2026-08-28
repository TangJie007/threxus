/**
 * Stage 3 装饰器：`@Injectable` / `@Inject`。
 *
 * - 主路径：字段 `@Inject(token)`（类或 `createToken`）
 * - 辅路径：`@Injectable({ inject: [...] })` 声明构造函数依赖
 *
 * 二者可同时使用；解析时先构造再写字段。
 */

export { Injectable } from './injectable';
export { Inject } from './inject';
