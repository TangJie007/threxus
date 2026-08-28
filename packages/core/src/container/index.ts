/**
 * DI 容器：注册 Provider、解析依赖、缓存单例实例，并驱动生命周期。
 *
 * 当前仅支持默认单例作用域；层级容器放到后续阶段。
 */

import {
  applicationDisposedError,
  applicationNotInitializedError,
  circularDependencyError,
  providerNotFoundError,
} from '../errors';
import {
  instanceHasHook,
  type LifecycleInstance,
  type OnApplicationBootstrap,
  type OnDispose,
  type OnModuleInit,
  type OnUpdate,
} from '../lifecycle';
import { readClassMetadata } from '../metadata';
import { loadModule, type LoadedModule } from '../module/load';
import type { Token } from '../token';
import {
  isConstructor,
  type Constructor,
  type InjectionToken,
  type Provider,
} from '../types';
import { isNil } from '../utils/guards';

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
 * 依赖注入容器。
 *
 * 职责：
 * 1. 注册各类 Provider
 * 2. 按令牌解析并缓存实例（单例）
 * 3. 检测循环依赖
 * 4. 根据类元数据完成构造注入与字段注入
 * 5. 通过 `load` 组装 `@Module` 模块图
 * 6. 通过 `init` / `update` / `dispose` 驱动生命周期
 */
export class Container {
  /** 已注册的 Provider（按令牌索引） */
  private readonly providers = new Map<InjectionToken, NormalizedProvider>();
  /** 已解析的单例实例缓存 */
  private readonly instances = new Map<InjectionToken, unknown>();
  /** 正在解析中的令牌栈，用于环依赖检测 */
  private readonly resolving = new Set<InjectionToken>();
  /** 最近一次 `load` 的根模块视图（若有） */
  private rootModule: LoadedModule | undefined;

  /** 是否已完成 `init()` */
  private initialized = false;
  /** 是否已 `dispose()` */
  private disposed = false;

  /**
   * 装配期收集的钩子列表（`init` 后固定；`update` 只读本数组）。
   */
  private moduleInits: OnModuleInit[] = [];
  private bootstraps: OnApplicationBootstrap[] = [];
  private updates: OnUpdate[] = [];
  private disposes: OnDispose[] = [];

  /**
   * 注册一个或多个 Provider。
   *
   * @param providers - 类简写或显式 `{ provide, use* }` 配置
   * @returns 当前容器，便于链式调用
   */
  register(...providers: Provider[]): this {
    this.assertActive();
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
   * 从根模块加载整图：递归 `imports`、注册 `providers`、校验导出边界。
   *
   * 注意：此时尚未触发生命周期；请接着调用 `init()`。
   *
   * @param rootModule - 使用 `@Module()` 装饰的根模块类
   * @returns 当前容器
   */
  load(rootModule: Constructor): this {
    this.assertActive();
    this.rootModule = loadModule(this, rootModule);
    return this;
  }

  /**
   * 最近一次成功 `load` 的根模块信息。
   */
  getRootModule(): LoadedModule | undefined {
    return this.rootModule;
  }

  /**
   * 是否已完成 `init()`。
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 是否已 `dispose()`。
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 装配生命周期：
   * 1. 急切解析全部已注册 Provider（保证钩子实例存在）
   * 2. 扫描实例上的钩子方法，写入扁平数组（只做一次）
   * 3. 依次调用 `onModuleInit` → `onApplicationBootstrap`
   *
   * @returns 当前容器
   */
  init(): this {
    this.assertActive();
    if (this.initialized) {
      return this;
    }

    for (const token of [...this.providers.keys()]) {
      this.get(token);
    }

    this.moduleInits = [];
    this.bootstraps = [];
    this.updates = [];
    this.disposes = [];

    for (const instance of this.instances.values()) {
      if (!isNil(instance) && typeof instance === 'object') {
        this.collectLifecycle(instance);
      }
    }

    for (let i = 0; i < this.moduleInits.length; i += 1) {
      this.moduleInits[i]!.onModuleInit();
    }
    for (let i = 0; i < this.bootstraps.length; i += 1) {
      this.bootstraps[i]!.onApplicationBootstrap();
    }

    this.initialized = true;
    return this;
  }

  /**
   * 调用所有 `onUpdate` 实现者；热路径无反射、不读 metadata。
   *
   * @param dt - 帧间隔（秒），由调用方计算后传入
   */
  update(dt: number): void {
    this.assertRunnable();
    const list = this.updates;
    for (let i = 0; i < list.length; i += 1) {
      list[i]!.onUpdate(dt);
    }
  }

  /**
   * 逆序调用 `onDispose`，并清空实例与钩子缓存。
   *
   * 销毁后容器不可再使用。
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (let i = this.disposes.length - 1; i >= 0; i -= 1) {
      this.disposes[i]!.onDispose();
    }

    this.moduleInits = [];
    this.bootstraps = [];
    this.updates = [];
    this.disposes = [];
    this.instances.clear();
    this.providers.clear();
    this.resolving.clear();
    this.rootModule = undefined;
    this.initialized = false;
    this.disposed = true;
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
    this.assertActive();

    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const provider = this.providers.get(token);
    if (!provider) {
      throw providerNotFoundError(token);
    }

    if (this.resolving.has(token)) {
      throw circularDependencyError([...this.resolving, token]);
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
   * 将实例上的钩子方法登记到对应扁平列表（装配期）。
   */
  private collectLifecycle(instance: object): void {
    const life = instance as LifecycleInstance;
    if (instanceHasHook(instance, 'onModuleInit')) {
      this.moduleInits.push(life as OnModuleInit);
    }
    if (instanceHasHook(instance, 'onApplicationBootstrap')) {
      this.bootstraps.push(life as OnApplicationBootstrap);
    }
    if (instanceHasHook(instance, 'onUpdate')) {
      this.updates.push(life as OnUpdate);
    }
    if (instanceHasHook(instance, 'onDispose')) {
      this.disposes.push(life as OnDispose);
    }
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

  /** 未销毁即可进行注册 / 解析 */
  private assertActive(): void {
    if (this.disposed) {
      throw applicationDisposedError();
    }
  }

  /** 已 init 且未销毁才可 update */
  private assertRunnable(): void {
    this.assertActive();
    if (!this.initialized) {
      throw applicationNotInitializedError();
    }
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
