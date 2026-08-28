/**
 * Application 基础行为测试（不依赖真实浏览器 rAF 长跑）。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Injectable, Module, type OnUpdate } from '@threxus/core';
import {
  APPLICATION,
  CLOCK,
  createApplication,
  clearRuntimeBindings,
} from '../src/index';

describe('createApplication', () => {
  afterEach(() => {
    clearRuntimeBindings();
    vi.unstubAllGlobals();
  });

  it('load + init 后可解析 APPLICATION / CLOCK，并驱动 onUpdate', () => {
    const frames: number[] = [];
    let rafCb: FrameRequestCallback | null = null;

    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        rafCb = cb;
        return 1;
      },
    );
    vi.stubGlobal('cancelAnimationFrame', () => {
      rafCb = null;
    });
    vi.stubGlobal('performance', { now: () => 1000 });

    @Injectable()
    class Probe implements OnUpdate {
      onUpdate(dt: number): void {
        frames.push(dt);
      }
    }

    @Module({ providers: [Probe] })
    class AppModule {}

    const app = createApplication(AppModule, { autoStart: true });
    expect(app.get(APPLICATION)).toBe(app);
    expect(app.get(CLOCK).delta).toBe(0);

    vi.stubGlobal('performance', { now: () => 1016 });
    rafCb?.(1016);

    expect(frames.length).toBe(1);
    expect(frames[0]).toBeCloseTo(0.016, 3);

    app.dispose();
    expect(app.container.isDisposed()).toBe(true);
  });

  it('autoStart: false 时不自动跑循环', () => {
    let scheduled = 0;
    vi.stubGlobal('requestAnimationFrame', () => {
      scheduled += 1;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('performance', { now: () => 0 });

    @Module({ providers: [] })
    class AppModule {}

    const app = createApplication(AppModule, { autoStart: false });
    expect(scheduled).toBe(0);
    expect(app.isRunning()).toBe(false);
    app.start();
    expect(scheduled).toBe(1);
    app.dispose();
  });
});
