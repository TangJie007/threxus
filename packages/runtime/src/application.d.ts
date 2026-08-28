/**
 * ThrexusApplication：load → init → rAF 主循环的应用壳。
 */
import { Container, type Constructor } from '@threxus/core';
import { RuntimeClock } from './clock';
/** `createApplication` / 构造选项 */
export interface ApplicationOptions {
    /** 可选画布；交给 `@threxus/three` 创建 Renderer */
    canvas?: HTMLCanvasElement | null;
    /** init 后是否自动 `start()` 主循环，默认 `true` */
    autoStart?: boolean;
}
/**
 * 应用运行时。
 *
 * 典型用法：
 * ```ts
 * const app = createApplication(AppModule, { canvas });
 * // 卸载时 app.dispose()
 * ```
 */
export declare class ThrexusApplication {
    /** 根 DI 容器 */
    readonly container: Container;
    /** 帧时钟 */
    readonly clock: RuntimeClock;
    private readonly canvas;
    private rafId;
    private running;
    private lastFrameTime;
    /**
     * @param userRoot - 用户根模块
     * @param options - 画布与自动启动等
     */
    constructor(userRoot: Constructor, options?: ApplicationOptions);
    /**
     * 是否正在跑 rAF 循环。
     */
    isRunning(): boolean;
    /**
     * 启动主循环（将 `onUpdate` 挂到 rAF）。
     */
    start(): this;
    /**
     * 停止主循环（不销毁容器）。
     */
    stop(): this;
    /**
     * 创建场景作用域（委托根容器）。
     *
     * @param sceneModule - 场景根模块
     */
    createSceneScope(sceneModule?: Constructor): Container;
    /**
     * 销毁当前场景作用域。
     */
    destroySceneScope(): void;
    /**
     * 从根容器取值。
     */
    get<T>(token: import('@threxus/core').InjectionToken<T>): T;
    /**
     * 停止循环并 dispose 根容器，清除 runtime 绑定。
     */
    dispose(): void;
}
/**
 * 创建并初始化应用。
 *
 * @param rootModule - 用户根模块（可 imports ThreeCoreModule 等）
 * @param options - 画布等选项
 */
export declare function createApplication(rootModule: Constructor, options?: ApplicationOptions): ThrexusApplication;
