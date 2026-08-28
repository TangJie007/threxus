/**
 * 将根模块递归加载进容器：处理 imports、注册 providers、校验导出边界。
 */

import { readClassMetadata, readModuleMetadata } from '../metadata';
import {
  moduleCircularDependencyError,
  moduleDependencyNotVisibleError,
  moduleExportNotProvidedError,
  moduleNotDecoratedError,
} from '../errors';
import type { Constructor, InjectionToken, Provider } from '../types';
import { getProviderToken, type ModuleMetadata } from './types';
import { isConstructor } from '../types';

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
export function loadModule(
  container: ModuleHost,
  rootModule: Constructor,
): LoadedModule {
  /** 已完成加载的模块 */
  const loaded = new Map<Constructor, LoadedModule>();
  /** 正在加载的栈（环检测） */
  const stack: Constructor[] = [];

  const visit = (Mod: Constructor): LoadedModule => {
    const cached = loaded.get(Mod);
    if (cached) {
      return cached;
    }

    if (stack.includes(Mod)) {
      throw moduleCircularDependencyError([...stack, Mod]);
    }

    const meta = requireModuleMetadata(Mod);
    stack.push(Mod);

    const importViews = meta.imports.map((imported) => visit(imported));
    container.register(...meta.providers);

    const localTokens = meta.providers.map(getProviderToken);
    const exportTokens = resolveExportTokens(Mod, meta, localTokens);

    validateModuleInjections(
      Mod,
      meta.providers,
      localTokens,
      importViews,
      container,
    );

    const view: LoadedModule = { type: Mod, exportTokens };
    loaded.set(Mod, view);
    stack.pop();
    return view;
  };

  return visit(rootModule);
}

/**
 * 读取并校验模块元数据。
 */
function requireModuleMetadata(Mod: Constructor): ModuleMetadata {
  const meta = readModuleMetadata(Mod);
  if (!meta) {
    throw moduleNotDecoratedError(Mod);
  }
  return meta;
}

/**
 * 计算模块对外导出令牌。
 */
function resolveExportTokens(
  Mod: Constructor,
  meta: ModuleMetadata,
  localTokens: InjectionToken[],
): InjectionToken[] {
  if (!meta.exports) {
    return [...localTokens];
  }

  const localSet = new Set(localTokens);
  for (const token of meta.exports) {
    if (!localSet.has(token)) {
      throw moduleExportNotProvidedError(Mod, token);
    }
  }

  return [...meta.exports];
}

/**
 * 校验本模块 providers 的构造/工厂/字段依赖是否落在可见令牌集合内。
 *
 * 可见来源：本地 providers ∪ imports 的 exports ∪ 宿主容器祖先中已有的令牌。
 */
function validateModuleInjections(
  Mod: Constructor,
  providers: Provider[],
  localTokens: InjectionToken[],
  importViews: LoadedModule[],
  host: ModuleHost,
): void {
  const available = new Set<InjectionToken>([
    ...localTokens,
    ...importViews.flatMap((view) => view.exportTokens),
  ]);

  for (const provider of providers) {
    for (const token of collectProviderDependencies(provider)) {
      if (available.has(token)) {
        continue;
      }
      // 层级作用域：允许依赖祖先容器已提供的令牌（如 Scene → App.Logger）
      if (host.hasInParent?.(token)) {
        continue;
      }
      throw moduleDependencyNotVisibleError(Mod, token);
    }
  }
}

/**
 * 收集 Provider 在解析时会请求的依赖令牌。
 */
function collectProviderDependencies(provider: Provider): InjectionToken[] {
  if (isConstructor(provider)) {
    return collectClassDependencies(provider);
  }

  if ('useValue' in provider) {
    return [];
  }

  if ('useClass' in provider) {
    return collectClassDependencies(provider.useClass);
  }

  if ('useFactory' in provider) {
    return [...(provider.inject ?? [])];
  }

  return [];
}

/**
 * 收集类的构造注入 + 字段注入令牌。
 */
function collectClassDependencies(Class: Constructor): InjectionToken[] {
  const meta = readClassMetadata(Class);
  return [...meta.inject, ...meta.fields.map((field) => field.token)];
}
