/**
 * @threxus/core 使用示例 —— 改这个文件即可边开发边调试。
 *
 * 开发方式：根目录 `pnpm dev`
 * - Vite 直接 alias 到 packages/core/src（改 core 源码立刻热更新）
 * - 打开浏览器控制台看 console 输出
 */

import {
  createContainer,
  createToken,
  Inject,
  Injectable,
} from '@threxus/core';

// ---------- 1. 定义 Token ----------

const APP_NAME = createToken<string>('app-name');
const CLOCK = createToken<{ now: () => number }>('clock');

// ---------- 2. 写可注入服务 ----------

@Injectable()
class Logger {
  info(message: string): void {
    console.log(`[Logger] ${message}`);
  }
}

@Injectable({ inject: [Logger, CLOCK, APP_NAME] })
class Greeter {
  /** 字段注入（辅路径） */
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

// ---------- 3. 组装容器并解析 ----------

export function run(): string {
  const container = createContainer()
    .set(APP_NAME, 'threxus')
    .set(CLOCK, { now: () => Date.now() })
    .register(Logger, Greeter);

  const greeter = container.resolve(Greeter);
  const message = greeter.greet('core');

  // 单例：再次 resolve 应是同一实例
  console.log('单例 Greeter?', container.resolve(Greeter) === greeter);
  console.log('字段 title:', greeter.title);

  return message;
}
