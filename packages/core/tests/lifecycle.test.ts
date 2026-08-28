/**
 * 生命周期：init / update / dispose。
 */

import { describe, expect, it } from 'vitest';
import {
  Injectable,
  Module,
  ThrexusError,
  ThrexusErrorCode,
  createContainer,
  type OnApplicationBootstrap,
  type OnDispose,
  type OnModuleInit,
  type OnUpdate,
} from '../src/index';

describe('Lifecycle', () => {
  it('按顺序调用 onModuleInit → onApplicationBootstrap', () => {
    const calls: string[] = [];

    @Injectable()
    class BootService implements OnModuleInit, OnApplicationBootstrap {
      onModuleInit(): void {
        calls.push('init');
      }

      onApplicationBootstrap(): void {
        calls.push('bootstrap');
      }
    }

    @Module({ providers: [BootService] })
    class AppModule {}

    createContainer().load(AppModule).init();
    expect(calls).toEqual(['init', 'bootstrap']);
  });

  it('update(dt) 调用 onUpdate，且未 init 时抛错', () => {
    const frames: number[] = [];

    @Injectable()
    class TickSystem implements OnUpdate {
      onUpdate(dt: number): void {
        frames.push(dt);
      }
    }

    @Module({ providers: [TickSystem] })
    class AppModule {}

    const container = createContainer().load(AppModule);
    expect(() => container.update(0.016)).toThrow(ThrexusError);
    try {
      container.update(0.016);
    } catch (error) {
      expect((error as ThrexusError).code).toBe(
        ThrexusErrorCode.APPLICATION_NOT_INITIALIZED,
      );
    }

    container.init();
    container.update(0.016);
    container.update(0.032);
    expect(frames).toEqual([0.016, 0.032]);
  });

  it('dispose 逆序调用 onDispose，之后禁止 get/update', () => {
    const calls: string[] = [];

    @Injectable()
    class First implements OnDispose {
      onDispose(): void {
        calls.push('first');
      }
    }

    @Injectable()
    class Second implements OnDispose {
      onDispose(): void {
        calls.push('second');
      }
    }

    @Module({ providers: [First, Second] })
    class AppModule {}

    const container = createContainer().load(AppModule).init();
    container.dispose();
    // 注册顺序 First → Second，销毁逆序 Second → First
    expect(calls).toEqual(['second', 'first']);
    expect(container.isDisposed()).toBe(true);

    expect(() => container.get(First)).toThrow(ThrexusError);
    try {
      container.update(0);
    } catch (error) {
      expect((error as ThrexusError).code).toBe(
        ThrexusErrorCode.APPLICATION_DISPOSED,
      );
    }
  });

  it('init 可幂等调用；dispose 可重复调用', () => {
    let inits = 0;

    @Injectable()
    class Once implements OnModuleInit {
      onModuleInit(): void {
        inits += 1;
      }
    }

    @Module({ providers: [Once] })
    class AppModule {}

    const container = createContainer().load(AppModule).init().init();
    expect(inits).toBe(1);
    container.dispose();
    container.dispose();
    expect(container.isDisposed()).toBe(true);
  });
});
