/**
 * 统一错误类型与工厂。
 *
 * 约定：
 * - 对外抛出均为 `ThrexusError`
 * - `message` 含可读的令牌名 / 模块名，便于定位
 * - `code` 稳定，便于测试与日志过滤
 */
import type { Constructor, InjectionToken } from '../types';
/**
 * Threxus 错误码（稳定字符串，勿随意改名）。
 */
export declare const ThrexusErrorCode: {
    /** 容器中找不到 Provider */
    readonly PROVIDER_NOT_FOUND: "THREXUS_PROVIDER_NOT_FOUND";
    /** Provider 解析时出现环依赖 */
    readonly CIRCULAR_DEPENDENCY: "THREXUS_CIRCULAR_DEPENDENCY";
    /** 模块互相 import 成环 */
    readonly MODULE_CIRCULAR_DEPENDENCY: "THREXUS_MODULE_CIRCULAR_DEPENDENCY";
    /** 类未使用 @Module 却被 load */
    readonly MODULE_NOT_DECORATED: "THREXUS_MODULE_NOT_DECORATED";
    /** exports 列出了不在 providers 中的令牌 */
    readonly MODULE_EXPORT_NOT_PROVIDED: "THREXUS_MODULE_EXPORT_NOT_PROVIDED";
    /** 模块内依赖了不可见令牌（未本地提供且未由 imports 导出） */
    readonly MODULE_DEPENDENCY_NOT_VISIBLE: "THREXUS_MODULE_DEPENDENCY_NOT_VISIBLE";
    /** 装饰器用在了错误的声明位置 */
    readonly INVALID_DECORATOR_TARGET: "THREXUS_INVALID_DECORATOR_TARGET";
    /** 容器尚未 init 就调用了 update 等运行期 API */
    readonly APPLICATION_NOT_INITIALIZED: "THREXUS_APPLICATION_NOT_INITIALIZED";
    /** 容器已 dispose，禁止再使用 */
    readonly APPLICATION_DISPOSED: "THREXUS_APPLICATION_DISPOSED";
};
export type ThrexusErrorCode = (typeof ThrexusErrorCode)[keyof typeof ThrexusErrorCode];
/**
 * 框架统一错误。
 *
 * `message` 形如：`[THREXUS_xxx] 中文说明…`
 */
export declare class ThrexusError extends Error {
    readonly code: ThrexusErrorCode;
    /**
     * @param code - 稳定错误码
     * @param detail - 不含错误码前缀的中文说明
     */
    constructor(code: ThrexusErrorCode, detail: string);
}
/**
 * 未注册 Provider。
 *
 * @param token - 查找失败的令牌
 */
export declare function providerNotFoundError(token: InjectionToken): ThrexusError;
/**
 * Provider 级循环依赖。
 *
 * @param chain - 解析栈上的令牌序列（含回到环点的令牌）
 */
export declare function circularDependencyError(chain: InjectionToken[]): ThrexusError;
/**
 * 模块级循环 import。
 *
 * @param chain - 模块类序列
 */
export declare function moduleCircularDependencyError(chain: Constructor[]): ThrexusError;
/**
 * 目标类缺少 `@Module()`。
 *
 * @param Mod - 被 load 的类
 */
export declare function moduleNotDecoratedError(Mod: Constructor): ThrexusError;
/**
 * exports 含未提供的令牌。
 *
 * @param Mod - 模块类
 * @param token - 非法导出令牌
 */
export declare function moduleExportNotProvidedError(Mod: Constructor, token: InjectionToken): ThrexusError;
/**
 * 模块内依赖不可见。
 *
 * @param Mod - 模块类
 * @param token - 不可见依赖
 */
export declare function moduleDependencyNotVisibleError(Mod: Constructor, token: InjectionToken): ThrexusError;
/**
 * 装饰器用于错误目标。
 *
 * @param decoratorName - 如 `@Injectable()`
 * @param expected - 期望目标描述
 */
export declare function invalidDecoratorTargetError(decoratorName: string, expected: string): ThrexusError;
/**
 * 容器尚未完成 `init()`。
 */
export declare function applicationNotInitializedError(): ThrexusError;
/**
 * 容器已销毁。
 */
export declare function applicationDisposedError(): ThrexusError;
