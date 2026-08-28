/**
 * Vue 示例：演示方案 C（构造 `inject` + 字段 `@Inject`）的最小用法。
 */

import {
  createContainer,
  createToken,
  Inject,
  Injectable,
} from '@threxus/core';

/** 时钟服务令牌 */
const CLOCK = createToken<{ now: () => number }>('clock');
/** 展示文案令牌 */
const LABEL = createToken<string>('label');

/**
 * 示例服务：
 * - 构造函数依赖 `CLOCK`（主路径）
 * - 字段依赖 `LABEL`（辅路径）
 */
@Injectable({ inject: [CLOCK] })
class TickerService {
  /** 由容器在构造后写入 */
  @Inject(LABEL)
  label!: string;

  constructor(readonly clock: { now: () => number }) {}

  /** 拼一条可读的演示文案 */
  describe(): string {
    return `${this.label} @ ${this.clock.now()}`;
  }
}

/**
 * 组装容器并解析 `TickerService`，返回演示文案。
 */
export function createDemoMessage(): string {
  const container = createContainer()
    .set(CLOCK, { now: () => 42 })
    .set(LABEL, 'scheme-C')
    .register(TickerService);

  return container.resolve(TickerService).describe();
}
