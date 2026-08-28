/**
 * @threxus/core 使用示例 —— 改这个文件即可边开发边调试。
 *
 * 开发方式：根目录 `pnpm dev`
 * - Vite 直接 alias 到 packages/core/src（改 core 源码立刻热更新）
 * - 打开浏览器控制台看 console 输出
 *
 * 本文件演示：Module（imports / providers / exports）+ 构造/字段注入。
 */

import {
  createContainer,
  createToken,
  Inject,
  Injectable,
  Module,
} from '@threxus/core';

// ---------- Token ----------

const APP_NAME = createToken<string>('app-name');
const CLOCK = createToken<{ now: () => number }>('clock');

// ---------- 服务 ----------

@Injectable()
class Logger {
  info(message: string): void {
    console.log(`[Logger] ${message}`);
  }
}

/** 仅 CoreModule 内部使用，不导出 */
@Injectable({ inject: [Logger] })
class InternalClockFactory {
  constructor(readonly logger: Logger) {}

  create(): { now: () => number } {
    this.logger.info('InternalClockFactory.create()');
    return { now: () => Date.now() };
  }
}

@Injectable({ inject: [Logger, CLOCK, APP_NAME] })
class Greeter {
  @Inject(APP_NAME)
  title!: string;

  constructor(
    readonly logger: Logger,
    readonly clock: { now: () => number },
    readonly appName: string,
  ) {
    this.logger.info('Greeter 构造完成');
  }

  greet(name: string): string {
    const text = `你好, ${name}!（${this.appName} / ${this.clock.now()}）`;
    this.logger.info(text);
    return text;
  }
}

// ---------- 模块 ----------

@Module({
  providers: [
    Logger,
    InternalClockFactory,
    { provide: APP_NAME, useValue: 'threxus' },
    {
      provide: CLOCK,
      useFactory: (factory: InternalClockFactory) => factory.create(),
      inject: [InternalClockFactory],
    },
  ],
  // 不导出 InternalClockFactory ⇒ FeatureModule 不能直接依赖它
  exports: [Logger, APP_NAME, CLOCK],
})
class CoreModule {}

@Module({
  imports: [CoreModule],
  providers: [Greeter],
  // 省略 exports ⇒ Greeter 对外可见
})
class FeatureModule {}

@Module({
  imports: [FeatureModule],
})
class AppModule {}

// ---------- 启动 ----------

export function run(): string {
  const container = createContainer().load(AppModule);

  const greeter = container.get(Greeter);
  const message = greeter.greet('module');

  console.log('根模块:', container.getRootModule()?.type.name);
  console.log('单例 Greeter?', container.get(Greeter) === greeter);
  console.log('字段 title:', greeter.title);

  return message;
}
