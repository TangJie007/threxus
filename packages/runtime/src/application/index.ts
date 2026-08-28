/**
 * ThrexusApplication：load → init → rAF 主循环的应用壳。
 */

import {
  Container,
  Module,
  createContainer,
  type Constructor,
} from '@threxus/core';
import { RuntimeClock } from '../clock';
import {
  RuntimeModule,
  clearRuntimeBindings,
  provideRuntimeBindings,
} from '../module';

/** `createApplication` / 构造选项 */
export interface ApplicationOptions {
  /** 可选画布；交给 `@threxus/three` 创建 Renderer */
  canvas?: HTMLCanvasElement | null;
  /** init 后是否自动 `start()` 主循环，默认 `true` */
  autoStart?: boolean;
}

/**
 * 组装 Boot 根模块：RuntimeModule + 用户根模块。
 */
function createBootModule(userRoot: Constructor): Constructor {
  @Module({
    imports: [RuntimeModule, userRoot],
  })
  class BootModule {}

  return BootModule;
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
export class ThrexusApplication {
  /** 根 DI 容器 */
  readonly container: Container;
  /** 帧时钟 */
  readonly clock: RuntimeClock;

  private readonly canvas: HTMLCanvasElement | null;
  private rafId = 0;
  private running = false;
  private lastFrameTime = 0;

  /**
   * @param userRoot - 用户根模块
   * @param options - 画布与自动启动等
   */
  constructor(userRoot: Constructor, options: ApplicationOptions = {}) {
    this.canvas = options.canvas ?? null;
    this.clock = new RuntimeClock();
    this.container = createContainer();

    provideRuntimeBindings({
      application: this,
      clock: this.clock,
      canvas: this.canvas,
    });

    const boot = createBootModule(userRoot);
    this.container.load(boot).init();

    if (options.autoStart !== false) {
      this.start();
    }
  }

  /**
   * 是否正在跑 rAF 循环。
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 启动主循环（将 `onUpdate` 挂到 rAF）。
   */
  start(): this {
    if (this.running || this.container.isDisposed()) {
      return this;
    }
    this.running = true;
    this.lastFrameTime = performance.now();
    const tick = (now: number): void => {
      if (!this.running) {
        return;
      }
      const delta = Math.min(0.1, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.clock.tick(delta);
      this.container.update(delta);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
    return this;
  }

  /**
   * 停止主循环（不销毁容器）。
   */
  stop(): this {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    return this;
  }

  /**
   * 创建场景作用域（委托根容器）。
   *
   * @param sceneModule - 场景根模块
   */
  createSceneScope(sceneModule?: Constructor): Container {
    return this.container.createSceneScope(sceneModule);
  }

  /**
   * 销毁当前场景作用域。
   */
  destroySceneScope(): void {
    this.container.destroySceneScope();
  }

  /**
   * 从根容器取值。
   */
  get<T>(token: import('@threxus/core').InjectionToken<T>): T {
    return this.container.get(token);
  }

  /**
   * 停止循环并 dispose 根容器，清除 runtime 绑定。
   */
  dispose(): void {
    this.stop();
    if (!this.container.isDisposed()) {
      this.container.dispose();
    }
    clearRuntimeBindings();
  }
}

/**
 * 创建并初始化应用。
 *
 * @param rootModule - 用户根模块（可 imports ThreeCoreModule 等）
 * @param options - 画布等选项
 */
export function createApplication(
  rootModule: Constructor,
  options?: ApplicationOptions,
): ThrexusApplication {
  return new ThrexusApplication(rootModule, options);
}
