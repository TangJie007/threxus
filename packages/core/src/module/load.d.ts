/**
 * 将根模块递归加载进容器：处理 imports、注册 providers、校验导出边界。
 */
import type { Constructor, InjectionToken, Provider } from '../types';
/**
 * 模块加载所需的最小容器能力（避免与 Container 循环依赖）。
 */
export interface ModuleHost {
    /** 注册 Provider */
    register(...providers: Provider[]): unknown;
    /**
     * 祖先容器是否已提供该令牌（不含本容器本地注册）。
     * 用于场景模块依赖 App 级服务，同时不影响同容器内的 exports 边界。
     */
    hasInParent?(token: InjectionToken): boolean;
}
/**
 * 单个模块加载完成后的对外视图。
 */
export interface LoadedModule {
    /** 模块类 */
    type: Constructor;
    /** 本模块对外导出的令牌（供其它模块 imports 使用） */
    exportTokens: InjectionToken[];
}
/**
 * 从根模块开始加载模块图到指定容器。
 *
 * 行为约定：
 * 1. 先递归加载 `imports`，再注册本模块 `providers`
 * 2. 同一模块被多次 import 时只处理一次
 * 3. 模块环依赖会抛错
 * 4. `exports` 省略时导出全部本地 provider 令牌
 * 5. 本模块内可注入令牌 = 本地 providers ∪ 各 import 的 exportTokens
 *
 * @param container - 目标容器（当前阶段为扁平根容器）
 * @param rootModule - 根模块类
 */
export declare function loadModule(container: ModuleHost, rootModule: Constructor): LoadedModule;
