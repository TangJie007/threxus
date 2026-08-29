import { describe, expect, it, vi } from 'vitest';
import {
  createLogger,
  createThreeApp,
  inspectRuntime,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('M12 diagnostics', () => {
  it('createLogger respects log level', () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: 'warn',
      sink: (level, message) => {
        lines.push(`${level}:${message}`);
      },
    });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(lines).toEqual(['warn:w', 'error:e']);
  });

  it('inspectRuntime reports healthy running app and renderer info', async () => {
    const options = createHeadlessThreeAppOptions();
    Object.assign(options.renderer, {
      info: {
        render: { calls: 3, triangles: 12, points: 0, lines: 0 },
        memory: { geometries: 1, textures: 2 },
        programs: [{}, {}],
      },
    });

    const app = createThreeApp(options);
    app.use({ name: 'noop', setup() {} });
    await app.start();

    const diag = inspectRuntime(app);
    expect(diag.summary.healthy).toBe(true);
    expect(diag.renderer?.drawCalls).toBe(3);
    expect(diag.renderer?.textures).toBe(2);
    expect(diag.app.features).toHaveLength(1);

    await app.dispose();
    const disposed = inspectRuntime(app);
    expect(disposed.summary.issues.some((item) => item.includes('disposed'))).toBe(
      true,
    );
  });

  it('warns when registering features after start', async () => {
    const warn = vi.fn();
    const logger = createLogger({
      level: 'warn',
      sink: (level, message) => {
        if (level === 'warn') {
          warn(message);
        }
      },
    });

    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      diagnostics: { logger, lifecycleWarnings: true },
    });
    app.use({ name: 'a', setup() {} });
    await app.start();

    expect(() => app.use({ name: 'late', setup() {} })).toThrow(/Cannot register/);
    expect(warn).toHaveBeenCalled();
    await app.dispose();
  });
});
