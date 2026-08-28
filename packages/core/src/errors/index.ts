/**
 * 统一错误类型与工厂。
 *
 * 约定：
 * - 对外抛出均为 `ThrexusError`
 * - `message` 含可读的令牌名 / 模块名，便于定位
 * - `code` 稳定，便于测试与日志过滤
 */

import type { Constructor, InjectionToken } from '../types';
import { describeClass, describeToken } from '../utils/describe';

/**
 * Threxus 错误码（稳定字符串，勿随意改名）。
 */
export const ThrexusErrorCode = {
  /** 容器中找不到 Provider */
  PROVIDER_NOT_FOUND: 'THREXUS_PROVIDER_NOT_FOUND',
  /** Provider 解析时出现环依赖 */
  CIRCULAR_DEPENDENCY: 'THREXUS_CIRCULAR_DEPENDENCY',
  /** 模块互相 import 成环 */
  MODULE_CIRCULAR_DEPENDENCY: 'THREXUS_MODULE_CIRCULAR_DEPENDENCY',
  /** 类未使用 @Module 却被 load */
  MODULE_NOT_DECORATED: 'THREXUS_MODULE_NOT_DECORATED',
  /** exports 列出了不在 providers 中的令牌 */
  MODULE_EXPORT_NOT_PROVIDED: 'THREXUS_MODULE_EXPORT_NOT_PROVIDED',
  /** 模块内依赖了不可见令牌（未本地提供且未由 imports 导出） */
  MODULE_DEPENDENCY_NOT_VISIBLE: 'THREXUS_MODULE_DEPENDENCY_NOT_VISIBLE',
  /** 装饰器用在了错误的声明位置 */
  INVALID_DECORATOR_TARGET: 'THREXUS_INVALID_DECORATOR_TARGET',
  /** 容器尚未 init 就调用了 update 等运行期 API */
  APPLICATION_NOT_INITIALIZED: 'THREXUS_APPLICATION_NOT_INITIALIZED',
  /** 容器已 dispose，禁止再使用 */
  APPLICATION_DISPOSED: 'THREXUS_APPLICATION_DISPOSED',
} as const;

export type ThrexusErrorCode =
  (typeof ThrexusErrorCode)[keyof typeof ThrexusErrorCode];

/**
 * 框架统一错误。
 *
 * `message` 形如：`[THREXUS_xxx] 中文说明…`
 */
export class ThrexusError extends Error {
  /**
   * @param code - 稳定错误码
   * @param detail - 不含错误码前缀的中文说明
   */
  constructor(
    readonly code: ThrexusErrorCode,
    detail: string,
  ) {
    super(`[${code}] ${detail}`);
    this.name = 'ThrexusError';
  }
}

/**
 * 未注册 Provider。
 *
 * @param token - 查找失败的令牌
 */
export function providerNotFoundError(token: InjectionToken): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.PROVIDER_NOT_FOUND,
    `未找到令牌 "${describeToken(token)}" 的 Provider。请确认已 register / set，或已通过 @Module providers 注册。`,
  );
}

/**
 * Provider 级循环依赖。
 *
 * @param chain - 解析栈上的令牌序列（含回到环点的令牌）
 */
export function circularDependencyError(
  chain: InjectionToken[],
): ThrexusError {
  const path = chain.map(describeToken).join(' -> ');
  return new ThrexusError(
    ThrexusErrorCode.CIRCULAR_DEPENDENCY,
    `检测到循环依赖：${path}`,
  );
}

/**
 * 模块级循环 import。
 *
 * @param chain - 模块类序列
 */
export function moduleCircularDependencyError(
  chain: Constructor[],
): ThrexusError {
  const path = chain.map(describeClass).join(' -> ');
  return new ThrexusError(
    ThrexusErrorCode.MODULE_CIRCULAR_DEPENDENCY,
    `检测到模块循环依赖：${path}`,
  );
}

/**
 * 目标类缺少 `@Module()`。
 *
 * @param Mod - 被 load 的类
 */
export function moduleNotDecoratedError(Mod: Constructor): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.MODULE_NOT_DECORATED,
    `类 "${describeClass(Mod)}" 未使用 @Module() 装饰，无法作为模块加载。`,
  );
}

/**
 * exports 含未提供的令牌。
 *
 * @param Mod - 模块类
 * @param token - 非法导出令牌
 */
export function moduleExportNotProvidedError(
  Mod: Constructor,
  token: InjectionToken,
): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.MODULE_EXPORT_NOT_PROVIDED,
    `模块 "${describeClass(Mod)}" 的 exports 包含未在 providers 中声明的令牌 "${describeToken(token)}"。`,
  );
}

/**
 * 模块内依赖不可见。
 *
 * @param Mod - 模块类
 * @param token - 不可见依赖
 */
export function moduleDependencyNotVisibleError(
  Mod: Constructor,
  token: InjectionToken,
): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.MODULE_DEPENDENCY_NOT_VISIBLE,
    `模块 "${describeClass(Mod)}" 中的 Provider 依赖了不可见令牌 "${describeToken(token)}"。` +
      `该令牌既不在本模块 providers 中，也未由 imports 的 exports 提供。`,
  );
}

/**
 * 装饰器用于错误目标。
 *
 * @param decoratorName - 如 `@Injectable()`
 * @param expected - 期望目标描述
 */
export function invalidDecoratorTargetError(
  decoratorName: string,
  expected: string,
): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.INVALID_DECORATOR_TARGET,
    `${decoratorName} 只能用于${expected}。`,
  );
}

/**
 * 容器尚未完成 `init()`。
 */
export function applicationNotInitializedError(): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.APPLICATION_NOT_INITIALIZED,
    `容器尚未 init()。请先 load(RootModule) 再调用 init()，然后再 update / 业务 get。`,
  );
}

/**
 * 容器已销毁。
 */
export function applicationDisposedError(): ThrexusError {
  return new ThrexusError(
    ThrexusErrorCode.APPLICATION_DISPOSED,
    `容器已 dispose()，不能再 get / update / init。请创建新的容器。`,
  );
}
