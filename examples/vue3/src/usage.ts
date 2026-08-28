/**
 * @threxus/core 使用示例 —— 改这个文件即可边开发边调试。
 *
 * 本文件演示：App 容器 + Scene 作用域切换（A → B）。
 */

import {
  createContainer,
  createToken,
  Injectable,
  Module,
  type OnDispose,
  type OnUpdate,
} from '@threxus/core';

const APP_NAME = createToken<string>('app-name');
const SCENE_NAME = createToken<string>('scene-name');

@Injectable()
class Logger {
  info(message: string): void {
    console.log(`[Logger] ${message}`);
  }
}

/** App 级常驻 */
@Injectable({ inject: [Logger, APP_NAME] })
class AppTicker implements OnUpdate, OnDispose {
  frames = 0;

  constructor(
    readonly logger: Logger,
    readonly appName: string,
  ) {}

  onUpdate(_dt: number): void {
    this.frames += 1;
  }

  onDispose(): void {
    this.logger.info(`AppTicker dispose（共 ${this.frames} 帧）`);
  }
}

/** Scene 级：依赖 App 的 Logger，随场景销毁 */
@Injectable({ inject: [Logger, SCENE_NAME] })
class SceneActor implements OnUpdate, OnDispose {
  frames = 0;

  constructor(
    readonly logger: Logger,
    readonly sceneName: string,
  ) {
    this.logger.info(`SceneActor enter: ${this.sceneName}`);
  }

  onUpdate(_dt: number): void {
    this.frames += 1;
    if (this.frames === 1) {
      this.logger.info(`SceneActor first update: ${this.sceneName}`);
    }
  }

  onDispose(): void {
    this.logger.info(
      `SceneActor leave: ${this.sceneName}（${this.frames} 帧）`,
    );
  }
}

@Module({
  providers: [
    Logger,
    { provide: APP_NAME, useValue: 'threxus' },
    AppTicker,
  ],
})
class AppModule {}

@Module({
  providers: [
    { provide: SCENE_NAME, useValue: 'Scene-A' },
    SceneActor,
  ],
})
class SceneAModule {}

@Module({
  providers: [
    { provide: SCENE_NAME, useValue: 'Scene-B' },
    SceneActor,
  ],
})
class SceneBModule {}

export interface RunHandle {
  message: string;
  stop: () => void;
}

/**
 * App init → Scene A 若干帧 → 切 Scene B → 再若干帧 → 销毁 App。
 */
export function run(): RunHandle {
  const app = createContainer().load(AppModule).init();
  const logger = app.get(Logger);
  const appTicker = app.get(AppTicker);

  app.createSceneScope(SceneAModule);

  let rafId = 0;
  let last = performance.now();
  let stopped = false;
  let phase: 'a' | 'b' | 'done' = 'a';

  const stop = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    cancelAnimationFrame(rafId);
    app.dispose();
  };

  const loop = (now: number): void => {
    if (stopped) {
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    app.update(dt);

    if (phase === 'a' && appTicker.frames >= 2) {
      logger.info('切换场景 A → B');
      app.createSceneScope(SceneBModule);
      phase = 'b';
    } else if (phase === 'b' && appTicker.frames >= 4) {
      logger.info('结束演示');
      phase = 'done';
      stop();
      return;
    }

    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);

  return {
    message: 'scope: App + Scene A → Scene B（详见控制台）',
    stop,
  };
}
