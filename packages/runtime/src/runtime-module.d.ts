/**
 * RuntimeModule：导出 APPLICATION / CLOCK / CANVAS。
 *
 * 绑定值通过 `provideRuntimeBindings` 在 `createApplication` 时注入，
 * 以便其它模块（如 ThreeCoreModule）可以 `imports: [RuntimeModule]`。
 */
import type { Clock } from './clock';
import { type ApplicationRef } from './tokens';
/** Application 启动前写入的运行时绑定 */
export interface RuntimeBindings {
    application: ApplicationRef;
    clock: Clock;
    canvas: HTMLCanvasElement | null;
}
/**
 * 写入运行时绑定（由 `createApplication` 调用）。
 *
 * @param next - 绑定快照
 */
export declare function provideRuntimeBindings(next: RuntimeBindings): void;
/**
 * 清除绑定（dispose 时调用，避免跨应用泄漏）。
 */
export declare function clearRuntimeBindings(): void;
export declare class RuntimeModule {
}
