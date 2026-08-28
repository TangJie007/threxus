/**
 * 生命周期钩子接口。
 *
 * 约定：在类上实现同名方法即可；容器在 `init()` 时扫描一次并缓存，
 * `update()` 热路径只遍历扁平数组，不再读 metadata。
 */
/**
 * 模块 providers 已注册且实例已创建后调用（每个实现者一次）。
 */
export interface OnModuleInit {
    onModuleInit(): void;
}
/**
 * 根模块全部就绪、所有 `onModuleInit` 完成之后调用。
 */
export interface OnApplicationBootstrap {
    onApplicationBootstrap(): void;
}
/**
 * 主循环每帧调用；`dt` 为秒（由调用方传入）。
 */
export interface OnUpdate {
    onUpdate(dt: number): void;
}
/**
 * 容器销毁时调用；用于释放监听、GPU 资源等。
 */
export interface OnDispose {
    onDispose(): void;
}
/** 可能实现了部分生命周期钩子的实例 */
export type LifecycleInstance = Partial<OnModuleInit & OnApplicationBootstrap & OnUpdate & OnDispose>;
/**
 * 判断类原型上是否声明了指定钩子方法（装配期使用）。
 *
 * @param Class - 构造函数
 * @param hook - 钩子方法名
 */
export declare function classHasHook(Class: new (...args: any[]) => unknown, hook: keyof LifecycleInstance): boolean;
/**
 * 判断实例是否实现了指定钩子。
 *
 * @param instance - 任意实例
 * @param hook - 钩子方法名
 */
export declare function instanceHasHook(instance: object, hook: keyof LifecycleInstance): boolean;
