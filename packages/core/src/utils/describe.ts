/**
 * 将注入令牌格式化为可读字符串（用于报错与日志）。
 */

import type { InjectionToken } from '../types';
import { isSymbol } from './guards';

/**
 * @param token - 注入令牌
 * @returns 便于阅读的描述
 */
export function describeToken(token: InjectionToken): string {
  if (isSymbol(token)) {
    return token.description ?? String(token);
  }

  return token.name || '(匿名类)';
}

/**
 * @param Class - 模块或服务类
 * @returns 类名或占位文案
 */
export function describeClass(Class: new (...args: any[]) => unknown): string {
  return Class.name || '(匿名类)';
}
