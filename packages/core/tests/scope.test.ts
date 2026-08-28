/**
 * 层级作用域：parent 查找、覆盖、SceneScope 切换与销毁。
 */

import { describe, expect, it } from 'vitest';
import {
  Injectable,
  Module,
  createContainer,
  createToken,
  type OnDispose,
} from '../src/index';

describe('Hierarchical scope', () => {
  it('子容器可解析父级 Provider，且作用域内单例', () => {
    const NAME = createToken<string>('name');

    @Injectable({ inject: [NAME] })
    class Greeter {
      constructor(readonly name: string) {}
    }

    @Module({
      providers: [{ provide: NAME, useValue: 'app' }, Greeter],
    })
    class AppModule {}

    const app = createContainer().load(AppModule).init();
    const scene = app.createChild();
    // 子作用域未注册 Greeter，应命中父级单例
    expect(scene.get(Greeter)).toBe(app.get(Greeter));
    expect(scene.get(NAME)).toBe('app');
  });

  it('子容器同名令牌覆盖父级（shadow）', () => {
    const LABEL = createToken<string>('label');

    @Module({
      providers: [{ provide: LABEL, useValue: 'parent' }],
    })
    class AppModule {}

    const app = createContainer().load(AppModule).init();
    const scene = app.createChild().set(LABEL, 'child');

    expect(app.get(LABEL)).toBe('parent');
    expect(scene.get(LABEL)).toBe('child');
  });

  it('createSceneScope 加载模块；destroySceneScope 触发场景 onDispose，App 保留', () => {
    const disposed: string[] = [];

    @Injectable()
    class AppLogger {
      lines: string[] = [];
      info(message: string): void {
        this.lines.push(message);
      }
    }

    @Injectable({ inject: [AppLogger] })
    class SceneActor implements OnDispose {
      constructor(readonly logger: AppLogger) {
        this.logger.info('SceneActor ready');
      }

      onDispose(): void {
        disposed.push('scene');
        this.logger.info('SceneActor disposed');
      }
    }

    @Module({ providers: [AppLogger] })
    class AppModule {}

    @Module({ providers: [SceneActor] })
    class SceneModule {}

    const app = createContainer().load(AppModule).init();
    const logger = app.get(AppLogger);

    const scene = app.createSceneScope(SceneModule);
    expect(app.getSceneScope()).toBe(scene);
    expect(scene.get(SceneActor)).toBeInstanceOf(SceneActor);
    expect(logger.lines).toContain('SceneActor ready');

    app.destroySceneScope();
    expect(app.getSceneScope()).toBeUndefined();
    expect(disposed).toEqual(['scene']);
    expect(scene.isDisposed()).toBe(true);

    // App 级仍在
    expect(app.get(AppLogger)).toBe(logger);
    expect(logger.lines).toContain('SceneActor disposed');
  });

  it('切换 Scene A → B 时旧场景销毁、新场景可用', () => {
    const disposed: string[] = [];
    const SCENE_ID = createToken<string>('scene-id');

    @Injectable()
    class AppClock {
      now = 1;
    }

    @Injectable({ inject: [AppClock, SCENE_ID] })
    class SceneHud implements OnDispose {
      constructor(
        readonly clock: AppClock,
        readonly id: string,
      ) {}

      onDispose(): void {
        disposed.push(this.id);
      }
    }

    @Module({ providers: [AppClock] })
    class AppModule {}

    @Module({
      providers: [
        { provide: SCENE_ID, useValue: 'A' },
        SceneHud,
      ],
    })
    class SceneAModule {}

    @Module({
      providers: [
        { provide: SCENE_ID, useValue: 'B' },
        SceneHud,
      ],
    })
    class SceneBModule {}

    const app = createContainer().load(AppModule).init();
    const clock = app.get(AppClock);

    const a = app.createSceneScope(SceneAModule);
    expect(a.get(SceneHud).id).toBe('A');
    expect(a.get(AppClock)).toBe(clock);

    const b = app.createSceneScope(SceneBModule);
    expect(a.isDisposed()).toBe(true);
    expect(disposed).toEqual(['A']);
    expect(b.get(SceneHud).id).toBe('B');
    expect(b.get(AppClock)).toBe(clock);
    expect(app.getSceneScope()).toBe(b);
  });

  it('父 dispose 会级联销毁子容器', () => {
    const disposed: string[] = [];

    @Injectable()
    class ChildSvc implements OnDispose {
      onDispose(): void {
        disposed.push('child');
      }
    }

    @Module({ providers: [] })
    class AppModule {}

    @Module({ providers: [ChildSvc] })
    class SceneModule {}

    const app = createContainer().load(AppModule).init();
    app.createSceneScope(SceneModule);
    app.dispose();

    expect(disposed).toEqual(['child']);
    expect(app.isDisposed()).toBe(true);
  });

  it('destroy 是 dispose 的别名', () => {
    @Module({ providers: [] })
    class AppModule {}

    const app = createContainer().load(AppModule).init();
    app.destroy();
    expect(app.isDisposed()).toBe(true);
  });
});
