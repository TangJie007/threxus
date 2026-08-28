/**
 * RuntimeModule：导出 APPLICATION / CLOCK / CANVAS。
 *
 * 绑定值通过 `provideRuntimeBindings` 在 `createApplication` 时注入，
 * 以便其它模块（如 ThreeCoreModule）可以 `imports: [RuntimeModule]`。
 */

import { Module } from '@threxus/core';
import type { Clock } from '../clock';
import { APPLICATION, CANVAS, CLOCK, type ApplicationRef } from '../tokens';

/** Application 启动前写入的运行时绑定 */
export interface RuntimeBindings {
  application: ApplicationRef;
  clock: Clock;
  canvas: HTMLCanvasElement | null;
}

let bindings: RuntimeBindings | null = null;

/**
 * 写入运行时绑定（由 `createApplication` 调用）。
 *
 * @param next - 绑定快照
 */
export function provideRuntimeBindings(next: RuntimeBindings): void {
  bindings = next;
}

/**
 * 清除绑定（dispose 时调用，避免跨应用泄漏）。
 */
export function clearRuntimeBindings(): void {
  bindings = null;
}

function requireBindings(): RuntimeBindings {
  if (!bindings) {
    throw new Error(
      'RuntimeModule 尚未绑定。请通过 createApplication() 启动，勿手动 load(RuntimeModule)。',
    );
  }
  return bindings;
}

@Module({
  providers: [
    {
      provide: APPLICATION,
      useFactory: () => requireBindings().application,
    },
    {
      provide: CLOCK,
      useFactory: () => requireBindings().clock,
    },
    {
      provide: CANVAS,
      useFactory: () => requireBindings().canvas,
    },
  ],
  exports: [APPLICATION, CLOCK, CANVAS],
})
export class RuntimeModule {}
