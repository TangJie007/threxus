/**
 * Token / Container / 注入路径测试。
 */

import { describe, expect, it } from 'vitest';
import {
  Inject,
  Injectable,
  ThrexusError,
  ThrexusErrorCode,
  createContainer,
  createToken,
} from '../src/index';

describe('createToken', () => {
  it('创建带 description 的唯一 symbol 令牌', () => {
    const a = createToken<string>('name');
    const b = createToken<string>('name');
    expect(typeof a).toBe('symbol');
    expect(a.description).toBe('name');
    expect(a).not.toBe(b);
  });
});

describe('Container', () => {
  it('set / get 绑定具体值', () => {
    const NAME = createToken<string>('app-name');
    const container = createContainer().set(NAME, 'threxus');
    expect(container.get(NAME)).toBe('threxus');
    expect(container.has(NAME)).toBe(true);
  });

  it('未注册令牌时抛出 PROVIDER_NOT_FOUND，消息含令牌名', () => {
    const MISSING = createToken<number>('missing-clock');
    const container = createContainer();

    expect(() => container.get(MISSING)).toThrow(ThrexusError);
    try {
      container.get(MISSING);
    } catch (error) {
      expect(error).toBeInstanceOf(ThrexusError);
      const threxusError = error as ThrexusError;
      expect(threxusError.code).toBe(ThrexusErrorCode.PROVIDER_NOT_FOUND);
      expect(threxusError.message).toContain('missing-clock');
      expect(threxusError.message).toContain(
        ThrexusErrorCode.PROVIDER_NOT_FOUND,
      );
    }
  });

  it('类简写注册 + 构造注入', () => {
    const CLOCK = createToken<{ now: () => number }>('clock');

    @Injectable({ inject: [CLOCK] })
    class Ticker {
      constructor(readonly clock: { now: () => number }) {}
    }

    const container = createContainer()
      .set(CLOCK, { now: () => 42 })
      .register(Ticker);

    expect(container.resolve(Ticker).clock.now()).toBe(42);
  });

  it('字段 @Inject 在构造后写入', () => {
    const LABEL = createToken<string>('label');

    @Injectable()
    class Tagged {
      @Inject(LABEL)
      label!: string;
    }

    const container = createContainer().set(LABEL, 'ok').register(Tagged);

    expect(container.resolve(Tagged).label).toBe('ok');
  });

  it('子类继承基类上的字段 @Inject', () => {
    const LABEL = createToken<string>('label');

    class BaseTagged {
      @Inject(LABEL)
      label!: string;
    }

    @Injectable()
    class Tagged extends BaseTagged {}

    const container = createContainer().set(LABEL, 'from-base').register(Tagged);

    expect(container.resolve(Tagged).label).toBe('from-base');
  });

  it('useFactory 按 inject 解析参数', () => {
    const A = createToken<number>('a');
    const SUM = createToken<number>('sum');

    const container = createContainer()
      .set(A, 3)
      .register({
        provide: SUM,
        useFactory: (a: number) => a + 7,
        inject: [A],
      });

    expect(container.get(SUM)).toBe(10);
  });

  it('useClass 映射到实现类', () => {
    const TOKEN = createToken<{ id: string }>('api');

    @Injectable()
    class ApiImpl {
      id = 'impl';
    }

    const container = createContainer().register({
      provide: TOKEN,
      useClass: ApiImpl,
    });

    expect(container.get(TOKEN).id).toBe('impl');
  });

  it('默认单例：多次 get / resolve 为同一引用', () => {
    @Injectable()
    class Service {}

    const container = createContainer().register(Service);
    const a = container.resolve(Service);
    const b = container.get(Service);
    expect(a).toBe(b);
  });

  it('Provider 循环依赖抛出 CIRCULAR_DEPENDENCY，消息含链路', () => {
    const TA = createToken<object>('token-a');
    const TB = createToken<object>('token-b');
    const container = createContainer()
      .register({
        provide: TA,
        useFactory: (b: object) => ({ b }),
        inject: [TB],
      })
      .register({
        provide: TB,
        useFactory: (a: object) => ({ a }),
        inject: [TA],
      });

    expect(() => container.get(TA)).toThrow(ThrexusError);
    try {
      container.get(TA);
    } catch (error) {
      const threxusError = error as ThrexusError;
      expect(threxusError.code).toBe(ThrexusErrorCode.CIRCULAR_DEPENDENCY);
      expect(threxusError.message).toContain('token-a');
      expect(threxusError.message).toContain('token-b');
      expect(threxusError.message).toContain(
        ThrexusErrorCode.CIRCULAR_DEPENDENCY,
      );
    }
  });
});
