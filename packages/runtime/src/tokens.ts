/**
 * 运行时约定 Token（与 Three 解耦）。
 */

import { createToken, type Container } from '@threxus/core';
import type { Clock } from './clock';

/**
 * Application 在 Token 中的最小形状（避免与 application.ts 循环依赖）。
 */
export interface ApplicationRef {
  readonly container: Container;
  start(): unknown;
  stop(): unknown;
  dispose(): void;
}

/** 当前 Application 实例 */
export const APPLICATION = createToken<ApplicationRef>('threxus.application');

/** 帧时钟（由 Application 主循环维护） */
export const CLOCK = createToken<Clock>('threxus.clock');

/** 可选画布；未绑定时为 `null` */
export const CANVAS = createToken<HTMLCanvasElement | null>('threxus.canvas');
