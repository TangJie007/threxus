/**
 * Module 相关类型。
 */

import type { Constructor, InjectionToken, Provider } from '../types';
import { isConstructor } from '../types';

/**
 * `@Module` 的配置项。
 *
 * - `imports`：依赖的其它模块（先加载它们，并获得其对外导出）
 * - `providers`：本模块注册到容器的 Provider
 * - `exports`：对外可见的令牌；**省略则等于导出全部 `providers` 的令牌**
 */
export interface ModuleOptions {
  /** 导入的模块类列表 */
  imports?: Constructor[];
  /** 本模块提供的依赖 */
  providers?: Provider[];
  /**
   * 导出给「导入了本模块的其它模块」使用的令牌列表。
   * 每一项须对应本模块某个 provider 的提供令牌。
   */
  exports?: InjectionToken[];
}

/**
 * 从类元数据读出的模块定义（已规范化）。
 */
export interface ModuleMetadata {
  /** 导入的模块类 */
  imports: Constructor[];
  /** 本模块 providers */
  providers: Provider[];
  /**
   * 原始 exports 配置。
   * `undefined` 表示未配置（加载时视为导出全部本地 provider 令牌）。
   */
  exports: InjectionToken[] | undefined;
}

/**
 * 从 Provider 取出其提供的令牌。
 *
 * @param provider - 用户声明的 Provider
 */
export function getProviderToken(provider: Provider): InjectionToken {
  if (isConstructor(provider)) {
    return provider;
  }
  return provider.provide;
}
