/**
 * DI 容器：注册 Provider、解析依赖、缓存单例实例。
 *
 * 当前壳子仅支持默认单例作用域；层级容器 / 生命周期等后续扩展。
 */

import { readClassMetadata } from '../metadata';
import type { Token } from '../token';
import {
  isConstructor,
  type Constructor,
  type InjectionToken,
  type Provider,
} from '../types';

/**
 * 内部归一化后的 Provider：统一通过 `resolve` 产出实例。
 */
type NormalizedProvider = {
  /** 查找用的令牌 */
  token: InjectionToken;
  /** 实际创建逻辑（由 register 时闭包捕获） */
  resolve: (container: Container) => unknown;
};

/**
 * 将令牌转为可读字符串，用于错误信息。
 *
 * @param token - 注入令牌
 */
function describeToken(token: InjectionToken): string {
  if (typeof token === 'symbol') {
    return token.description ?? String(token);
  }

  return token.name || '(匿名类)';
}

/**
 * 依赖注入容器。
 *
 * 职责：
 * 1. 注册各类 Provider
 * 2. 按令牌解析并缓存实例（单例）
 * 3. 检测循环依赖
 * 4. 根据类元数据完成构造注入与字段注入
 */
export class Container {
  /** 已注册的 Provider（按令牌索引） */
  private readonly providers = new Map<InjectionToken, NormalizedProvider>();
  /** 已解析的单例实例缓存 */
  private readonly instances = new Map<InjectionToken, unknown>();
  /** 正在解析中的令牌栈，用于环依赖检测 */
  private readonly resolving = new Set<InjectionToken>();

  /**
   * 注册一个或多个 Provider。
   *
   * @param providers - 类简写或显式 `{ provide, use* }` 配置
   * @returns 当前容器，便于链式调用
   */
  register(...providers: Provider[]): this {
    for (const provider of providers) {
      this.registerOne(provider);
    }
    return this;
  }

  /**
   * 直接绑定一个具体值（等价于 `{ provide, useValue }`）。
   *
   * @typeParam T - 值类型
   * @param token - 令牌或类
   * @param value - 要绑定的值
   * @returns 当前容器
   */
  set<T>(token: Token<T> | Constructor<T>, value: T): this {
    return this.register({ provide: token, useValue: value });
  }

  /**
   * 判断令牌是否已注册（含已缓存实例的情况）。
   *
   * @param token - 注入令牌
   */
  has(token: InjectionToken): boolean {
    return this.providers.has(token) || this.instances.has(token);
  }

  /**
   * 按令牌获取实例；首次解析后缓存为单例。
   *
   * @typeParam T - 期望的实例类型
   * @param token - 注入令牌
   * @throws 未注册 Provider，或检测到循环依赖时抛出错误
   */
  get<T>(token: InjectionToken<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const provider = this.providers.get(token);
    if (!provider) {
      throw new Error(`未找到令牌 "${describeToken(token)}" 的 Provider。`);
    }

    if (this.resolving.has(token)) {
      const chain = [...this.resolving, token].map(describeToken).join(' -> ');
      throw new Error(`检测到循环依赖：${chain}`);
    }

    this.resolving.add(token);
    try {
      const instance = provider.resolve(this);
      this.instances.set(token, instance);
      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * 解析某个类：若尚未注册则先按类简写注册，再 `get`。
   *
   * @typeParam T - 实例类型
   * @param Class - 目标类构造函数
   */
  resolve<T>(Class: Constructor<T>): T {
    if (!this.providers.has(Class)) {
      this.register(Class);
    }
    return this.get(Class);
  }

  /**
   * 将单个 Provider 归一化并写入内部表。
   *
   * @param provider - 用户传入的 Provider
   */
  private registerOne(provider: Provider): void {
    if (isConstructor(provider)) {
      this.put({
        token: provider,
        resolve: (container) => container.instantiate(provider),
      });
      return;
    }

    if ('useValue' in provider) {
      this.put({
        token: provider.provide,
        resolve: () => provider.useValue,
      });
      // useValue 可立即缓存，后续 get 无需再走 resolve
      this.instances.set(provider.provide, provider.useValue);
      return;
    }

    if ('useClass' in provider) {
      const Class = provider.useClass;
      this.put({
        token: provider.provide,
        resolve: (container) => container.instantiate(Class),
      });
      return;
    }

    if ('useFactory' in provider) {
      const inject = provider.inject ?? [];
      const factory = provider.useFactory;
      this.put({
        token: provider.provide,
        resolve: (container) => {
          const deps = inject.map((dep) => container.get(dep));
          return factory(...deps);
        },
      });
    }
  }

  /**
   * 写入归一化 Provider；若令牌已存在则清除旧实例缓存以便重新解析。
   *
   * @param provider - 归一化后的 Provider
   */
  private put(provider: NormalizedProvider): void {
    if (
      this.providers.has(provider.token) ||
      this.instances.has(provider.token)
    ) {
      this.instances.delete(provider.token);
    }
    this.providers.set(provider.token, provider);
  }

  /**
   * 根据类元数据创建实例：先构造注入，再字段注入。
   *
   * @typeParam T - 实例类型
   * @param Class - 目标类
   */
  private instantiate<T>(Class: Constructor<T>): T {
    const meta = readClassMetadata(Class);
    const ctorDeps = meta.inject.map((token) => this.get(token));
    const instance = new Class(...ctorDeps);

    for (const field of meta.fields) {
      Object.defineProperty(instance, field.name, {
        value: this.get(field.token),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    return instance;
  }
}

/**
 * 创建一个空的依赖注入容器。
 *
 * @returns 新的 `Container` 实例
 */
export function createContainer(): Container {
  return new Container();
}
