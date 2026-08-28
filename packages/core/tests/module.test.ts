/**
 * Module 加载、exports 边界与相关错误体验。
 */

import { describe, expect, it } from 'vitest';
import {
  Injectable,
  Module,
  THREXUS_METADATA,
  ThrexusError,
  ThrexusErrorCode,
  createContainer,
  createToken,
} from '../src/index';

describe('Module.load', () => {
  it('递归 imports 并注册 providers', () => {
    const NAME = createToken<string>('name');

    @Injectable()
    class Logger {
      lines: string[] = [];
      info(message: string): void {
        this.lines.push(message);
      }
    }

    @Injectable({ inject: [Logger, NAME] })
    class Greeter {
      constructor(
        readonly logger: Logger,
        readonly name: string,
      ) {}

      greet(): string {
        const text = `hi ${this.name}`;
        this.logger.info(text);
        return text;
      }
    }

    @Module({
      providers: [Logger, { provide: NAME, useValue: 'threxus' }],
      exports: [Logger, NAME],
    })
    class CoreModule {}

    @Module({
      imports: [CoreModule],
      providers: [Greeter],
    })
    class AppModule {}

    const container = createContainer().load(AppModule);
    const greeter = container.get(Greeter);
    expect(greeter.greet()).toBe('hi threxus');
    expect(container.get(Logger).lines).toEqual(['hi threxus']);
    expect(container.getRootModule()?.type).toBe(AppModule);
  });

  it('同一模块被多次 import 只处理一次且保持单例', () => {
    let constructed = 0;

    @Injectable()
    class Shared {
      constructor() {
        constructed += 1;
      }
    }

    @Module({
      providers: [Shared],
      exports: [Shared],
    })
    class SharedModule {}

    @Module({ imports: [SharedModule] })
    class LeftModule {}

    @Module({ imports: [SharedModule] })
    class RightModule {}

    @Module({ imports: [LeftModule, RightModule] })
    class RootModule {}

    const container = createContainer().load(RootModule);
    expect(container.get(Shared)).toBe(container.get(Shared));
    expect(constructed).toBe(1);
  });

  it('省略 exports 时导出全部本地 providers', () => {
    @Injectable()
    class PublicService {}

    const PROBE = createToken<string>('probe');

    @Module({ providers: [PublicService] })
    class LibModule {}

    @Module({
      imports: [LibModule],
      providers: [
        {
          provide: PROBE,
          useFactory: (svc: PublicService) => svc.constructor.name,
          inject: [PublicService],
        },
      ],
    })
    class AppModule {}

    const container = createContainer().load(AppModule);
    expect(container.get(PROBE)).toBe('PublicService');
  });

  it('依赖未导出令牌时抛出 MODULE_DEPENDENCY_NOT_VISIBLE', () => {
    @Injectable()
    class Secret {}

    @Injectable()
    class Public {}

    @Injectable({ inject: [Secret] })
    class NeedsSecret {
      constructor(readonly secret: Secret) {}
    }

    @Module({
      providers: [Secret, Public],
      exports: [Public],
    })
    class CoreModule {}

    @Module({
      imports: [CoreModule],
      providers: [NeedsSecret],
    })
    class AppModule {}

    expect(() => createContainer().load(AppModule)).toThrow(ThrexusError);
    try {
      createContainer().load(AppModule);
    } catch (error) {
      const threxusError = error as ThrexusError;
      expect(threxusError.code).toBe(
        ThrexusErrorCode.MODULE_DEPENDENCY_NOT_VISIBLE,
      );
      expect(threxusError.message).toContain('AppModule');
      expect(threxusError.message).toContain('Secret');
      expect(threxusError.message).toContain(
        ThrexusErrorCode.MODULE_DEPENDENCY_NOT_VISIBLE,
      );
    }
  });

  it('exports 含未提供令牌时抛出 MODULE_EXPORT_NOT_PROVIDED', () => {
    const GHOST = createToken<string>('ghost');

    @Module({
      providers: [],
      exports: [GHOST],
    })
    class BrokenModule {}

    expect(() => createContainer().load(BrokenModule)).toThrow(ThrexusError);
    try {
      createContainer().load(BrokenModule);
    } catch (error) {
      const threxusError = error as ThrexusError;
      expect(threxusError.code).toBe(
        ThrexusErrorCode.MODULE_EXPORT_NOT_PROVIDED,
      );
      expect(threxusError.message).toContain('BrokenModule');
      expect(threxusError.message).toContain('ghost');
    }
  });

  it('未装饰 @Module 的类 load 时抛出 MODULE_NOT_DECORATED', () => {
    class Plain {}

    expect(() => createContainer().load(Plain)).toThrow(ThrexusError);
    try {
      createContainer().load(Plain);
    } catch (error) {
      const threxusError = error as ThrexusError;
      expect(threxusError.code).toBe(ThrexusErrorCode.MODULE_NOT_DECORATED);
      expect(threxusError.message).toContain('Plain');
    }
  });

  it('模块循环 import 抛出 MODULE_CIRCULAR_DEPENDENCY', () => {
    @Module({ imports: [] })
    class ModuleA {}

    @Module({ imports: [ModuleA] })
    class ModuleB {}

    // 在装饰之后把 A 的 imports 改成 B，构造 A <-> B 环
    const metadataKey = Symbol.metadata!;
    const bag = (ModuleA as unknown as Record<symbol, Record<symbol, {
      module?: { imports: unknown[] };
    }>>)[metadataKey];
    const record = bag[THREXUS_METADATA];
    record.module!.imports = [ModuleB];

    expect(() => createContainer().load(ModuleA)).toThrow(ThrexusError);
    try {
      createContainer().load(ModuleA);
    } catch (error) {
      const threxusError = error as ThrexusError;
      expect(threxusError.code).toBe(
        ThrexusErrorCode.MODULE_CIRCULAR_DEPENDENCY,
      );
      expect(threxusError.message).toContain('ModuleA');
      expect(threxusError.message).toContain('ModuleB');
    }
  });
});
