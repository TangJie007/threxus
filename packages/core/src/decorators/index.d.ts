/**
 * Stage 3 装饰器：`@Injectable` / `@Inject`。
 *
 * - 主路径：`@Injectable({ inject: [...] })` 声明构造函数依赖
 * - 辅路径：`@Inject(token)` 声明字段依赖
 *
 * 二者可同时使用（方案 C）；解析时先构造再写字段。
 */
export { Injectable } from './injectable';
export { Inject } from './inject';
