/**
 * 将注入令牌格式化为可读字符串（用于报错与日志）。
 */
import type { InjectionToken } from '../types';
/**
 * @param token - 注入令牌
 * @returns 便于阅读的描述
 */
export declare function describeToken(token: InjectionToken): string;
/**
 * @param Class - 模块或服务类
 * @returns 类名或占位文案
 */
export declare function describeClass(Class: new (...args: any[]) => unknown): string;
