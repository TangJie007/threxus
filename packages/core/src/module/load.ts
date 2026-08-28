/**
 * 将根模块递归加载进容器：处理 imports、注册 providers、校验导出边界。
 */

import { readClassMetadata, readModuleMetadata } from '../metadata';
import type { Constructor, InjectionToken, Provider } from '../types';
import { describeClass, describeToken } from '../utils/describe';
import { getProviderToken, type ModuleMetadata } from './types';

/**
 * 模块加载所需的最小容器能力（避免与 Container 循环依赖）。
 */
export interface ModuleHost {
  /** 注册 Provider */
  register(...providers: Provider[]): unknown;
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
      const cycle = [...stack, Mod].map(describeClass).join(' -> ');
      throw new Error(`检测到模块循环依赖：${cycle}`);
    }

    const meta = requireModuleMetadata(Mod);
    stack.push(Mod);

    const importViews = meta.imports.map((imported) => visit(imported));
    container.register(...meta.providers);

    const localTokens = meta.providers.map(getProviderToken);
    const exportTokens = resolveExportTokens(Mod, meta, localTokens);

    validateModuleInjections(Mod, meta.providers, localTokens, importViews);

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
    throw new Error(
      `类 "${describeClass(Mod)}" 未使用 @Module() 装饰，无法作为模块加载。`,
    );
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
      throw new Error(
        `模块 "${describeClass(Mod)}" 的 exports 包含未在 providers 中声明的令牌 "${describeToken(token)}"。`,
      );
    }
  }

  return [...meta.exports];
}

/**
 * 校验本模块 providers 的构造/工厂/字段依赖是否落在可见令牌集合内。
 */
function validateModuleInjections(
  Mod: Constructor,
  providers: Provider[],
  localTokens: InjectionToken[],
  importViews: LoadedModule[],
): void {
  const available = new Set<InjectionToken>([
    ...localTokens,
    ...importViews.flatMap((view) => view.exportTokens),
  ]);

  for (const provider of providers) {
    for (const token of collectProviderDependencies(provider)) {
      if (!available.has(token)) {
        throw new Error(
          `模块 "${describeClass(Mod)}" 中的 Provider 依赖了不可见令牌 "${describeToken(token)}"。` +
            `该令牌既不在本模块 providers 中，也未由 imports 的 exports 提供。`,
        );
      }
    }
  }
}

/**
 * 收集 Provider 在解析时会请求的依赖令牌。
 */
function collectProviderDependencies(provider: Provider): InjectionToken[] {
  if (typeof provider === 'function') {
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
