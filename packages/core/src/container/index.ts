/**
 * DI 容器：注册 Provider、解析依赖、缓存单例实例，并驱动生命周期。
 *
 * 支持层级作用域：子容器找不到令牌时向 `parent` 查找；
 * 子容器可覆盖父级同名令牌（shadow）。场景切换用 `createSceneScope` /
 * `destroySceneScope`（或子容器 `destroy`）。
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
 * 2. 按令牌解析并缓存实例（单例，作用域内）
 * 3. 检测循环依赖
 * 4. 根据类元数据完成构造注入与字段注入
 * 5. 通过 `load` 组装 `@Module` 模块图
 * 6. 通过 `init` / `update` / `dispose` 驱动生命周期
 * 7. 通过 parent / SceneScope 支持 App → Scene 层级
 */
export class Container {
  /** 父容器；解析时本地未命中则委托给父级 */
  private readonly parent: Container | undefined;
  /** 直接子容器（含当前 sceneScope） */
  private readonly children = new Set<Container>();
  /** 当前场景作用域（最多一个；再创建会先销毁旧的） */
  private sceneScope: Container | undefined;

  /** 已注册的 Provider（按令牌索引） */
  private readonly providers = new Map<InjectionToken, NormalizedProvider>();
  /** 已解析的单例实例缓存（仅本作用域） */
  private readonly instances = new Map<InjectionToken, unknown>();
  /** 正在解析中的令牌栈，用于环依赖检测 */
  private readonly resolving = new Set<InjectionToken>();
  /** 最近一次 `load` 的根模块视图（若有） */
  private rootModule: LoadedModule | undefined;

  /** 是否已完成 `init()` */
  private initialized = false;
  /** 是否已 `dispose` / `destroy` */
  private disposed = false;

  /**
   * 装配期收集的钩子列表（`init` 后固定；`update` 只读本数组）。
   */
  private moduleInits: OnModuleInit[] = [];
  private bootstraps: OnApplicationBootstrap[] = [];
  private updates: OnUpdate[] = [];
  private disposes: OnDispose[] = [];

  /**
   * @param parent - 可选父容器；传入后构成本地优先、向上查找的层级作用域
   */
  constructor(parent?: Container) {
    this.parent = parent;
  }

  /**
   * 父容器（若有）。
   */
  getParent(): Container | undefined {
    return this.parent;
  }

  /**
   * 当前场景子作用域（若有）。
   */
  getSceneScope(): Container | undefined {
    return this.sceneScope;
  }

  /**
   * 创建一个普通子容器（不自动设为 sceneScope）。
   *
   * @returns 子容器
   */
  createChild(): Container {
    this.assertActive();
    const child = new Container(this);
    this.children.add(child);
    return child;
  }

  /**
   * 创建（并可选加载）场景作用域。
   *
   * - 若已存在场景作用域，会先 `destroySceneScope()`
   * - 若传入 `sceneModule`，会对子容器执行 `load` + `init`
   *
   * 子级可 `get` 到父级 Provider；子级同名令牌会覆盖父级（shadow）。
   *
   * @param sceneModule - 场景根模块（可选）
   * @returns 场景子容器
   */
  createSceneScope(sceneModule?: Constructor): Container {
    this.assertActive();
    this.destroySceneScope();

    const scope = this.createChild();
    this.sceneScope = scope;

    if (sceneModule) {
      scope.load(sceneModule).init();
    }

    return scope;
  }

  /**
   * 销毁当前场景作用域（调用其子树 `onDispose`），App 级实例保留。
   */
  destroySceneScope(): void {
    if (!this.sceneScope) {
      return;
    }
    const scope = this.sceneScope;
    this.sceneScope = undefined;
    scope.destroy();
  }

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
   * 是否已 `dispose` / `destroy`。
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 装配生命周期：
   * 1. 急切解析本作用域全部 Provider
   * 2. 扫描本作用域实例上的钩子，写入扁平数组（只做一次）
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
   * 调用本作用域所有 `onUpdate`；若存在场景作用域则接着更新场景。
   *
   * 热路径无反射、不读 metadata。
   *
   * @param dt - 帧间隔（秒），由调用方计算后传入
   */
  update(dt: number): void {
    this.assertRunnable();
    const list = this.updates;
    for (let i = 0; i < list.length; i += 1) {
      list[i]!.onUpdate(dt);
    }

    const scene = this.sceneScope;
    if (scene && !scene.disposed && scene.initialized) {
      scene.update(dt);
    }
  }

  /**
   * 销毁本容器：先销毁全部子容器，再逆序 `onDispose`，并清空本作用域缓存。
   *
   * 销毁后不可再使用。`destroy` 为同义别名（场景语义）。
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const child of [...this.children]) {
      child.dispose();
    }
    this.children.clear();
    this.sceneScope = undefined;

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

    this.parent?.detachChild(this);
  }

  /**
   * `dispose` 的场景语义别名。
   */
  destroy(): void {
    this.dispose();
  }

  /**
   * 判断令牌是否在本作用域或祖先中已注册。
   *
   * @param token - 注入令牌
   */
  has(token: InjectionToken): boolean {
    if (this.providers.has(token) || this.instances.has(token)) {
      return true;
    }
    return this.hasInParent(token);
  }

  /**
   * 仅判断祖先是否已提供令牌（模块可见性校验用，不含本地）。
   *
   * @param token - 注入令牌
   */
  hasInParent(token: InjectionToken): boolean {
    return this.parent?.has(token) ?? false;
  }

  /**
   * 按令牌获取实例；本作用域单例缓存。
   *
   * 查找顺序：本地实例 → 本地 Provider（创建并缓存到本作用域）→ 父容器 `get`。
   *
   * @typeParam T - 期望的实例类型
   * @param token - 注入令牌
   */
  get<T>(token: InjectionToken<T>): T {
    this.assertActive();

    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const provider = this.providers.get(token);
    if (provider) {
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

    if (this.parent) {
      return this.parent.get(token);
    }

    throw providerNotFoundError(token);
  }

  /**
   * 解析某个类：若本作用域尚未注册则先按类简写注册，再 `get`。
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
   * 父容器移除已销毁的子引用。
   */
  private detachChild(child: Container): void {
    this.children.delete(child);
    if (this.sceneScope === child) {
      this.sceneScope = undefined;
    }
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
 * 创建一个空的根依赖注入容器。
 *
 * @returns 新的根 `Container` 实例
 */
export function createContainer(): Container {
  return new Container();
}
