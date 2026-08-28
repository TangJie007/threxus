/**
 * 运行时约定 Token（与 Three 解耦）。
 */
import { type Container } from '@threxus/core';
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
export declare const APPLICATION: import("@threxus/core").Token<ApplicationRef>;
/** 帧时钟（由 Application 主循环维护） */
export declare const CLOCK: import("@threxus/core").Token<Clock>;
/** 可选画布；未绑定时为 `null` */
export declare const CANVAS: import("@threxus/core").Token<HTMLCanvasElement | null>;
