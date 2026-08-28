/**
 * @threxus/core 使用示例 —— 改这个文件即可边开发边调试。
 *
 * 开发方式：根目录 `pnpm dev`
 * - Vite 直接 alias 到 packages/core/src（改 core 源码立刻热更新）
 * - 打开浏览器控制台看 console 输出
 *
 * 本文件演示：Module + 生命周期（init / update / dispose）。
 */

import {
  createContainer,
  createToken,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnDispose,
  type OnModuleInit,
  type OnUpdate,
} from '@threxus/core';

const APP_NAME = createToken<string>('app-name');

@Injectable()
class Logger {
  info(message: string): void {
    console.log(`[Logger] ${message}`);
  }
}

@Injectable({ inject: [Logger, APP_NAME] })
class BootProbe implements OnModuleInit, OnApplicationBootstrap, OnDispose {
  constructor(
    readonly logger: Logger,
    readonly appName: string,
  ) {}

  onModuleInit(): void {
    this.logger.info(`onModuleInit (${this.appName})`);
  }

  onApplicationBootstrap(): void {
    this.logger.info('onApplicationBootstrap');
  }

  onDispose(): void {
    this.logger.info('onDispose BootProbe');
  }
}

/** 每帧更新；热路径由容器扁平数组调用 */
@Injectable({ inject: [Logger] })
class TickSystem implements OnUpdate, OnDispose {
  frames = 0;

  constructor(readonly logger: Logger) {}

  onUpdate(dt: number): void {
    this.frames += 1;
    if (this.frames <= 3) {
      this.logger.info(`onUpdate #${this.frames} dt=${dt.toFixed(4)}`);
    }
  }

  onDispose(): void {
    this.logger.info(`onDispose TickSystem（共 ${this.frames} 帧）`);
  }
}

@Module({
  providers: [
    Logger,
    { provide: APP_NAME, useValue: 'threxus' },
    BootProbe,
    TickSystem,
  ],
})
class AppModule {}

export interface RunHandle {
  /** 首屏展示文案 */
  message: string;
  /** 停止 rAF 并 dispose 容器 */
  stop: () => void;
}

/**
 * 加载模块 → init → 用 rAF 打几帧 update → 自动 dispose。
 */
export function run(): RunHandle {
  const container = createContainer().load(AppModule).init();
  const ticker = container.get(TickSystem);

  let rafId = 0;
  let last = performance.now();
  let stopped = false;

  const stop = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    cancelAnimationFrame(rafId);
    container.dispose();
  };

  const loop = (now: number): void => {
    if (stopped) {
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    container.update(dt);

    // 演示几帧后自动销毁，方便在控制台看完整生命周期
    if (ticker.frames >= 3) {
      stop();
      return;
    }
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);

  return {
    message: 'lifecycle: init → rAF update ×3 → dispose（详见控制台）',
    stop,
  };
}
