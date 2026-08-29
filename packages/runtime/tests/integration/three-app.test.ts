import { describe, expect, it, vi } from 'vitest';
import {
  createServiceKey,
  createThreeApp,
  type Disposable,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

function createCanvas(): HTMLCanvasElement {
  return createHeadlessThreeAppOptions().canvas;
}

function createAppOptions(canvas: HTMLCanvasElement) {
  return createHeadlessThreeAppOptions(canvas);
}

describe('ThreeApp', () => {
  it('starts dependencies first and disposes consumers first', async () => {
    const records: string[] = [];
    const Service = createServiceKey<{ value: number }>('service');
    const app = createThreeApp(createAppOptions(createCanvas()));

    app.use({
      name: 'consumer',
      dependencies: [Service],
      setup(context) {
        records.push(`consumer:${context.inject(Service).value}`);
        context.addCleanup(() => {
          records.push('consumer disposed');
        });
      },
    });
    app.use({
      name: 'provider',
      provides: [Service],
      setup(context) {
        records.push('provider');
        context.provide(Service, { value: 1 });
        context.addCleanup(() => {
          records.push('provider disposed');
        });
      },
    });

    await app.start();
    expect(app.state).toBe('running');
    expect(records).toEqual(['provider', 'consumer:1']);

    await app.dispose();
    expect(app.state).toBe('disposed');
    expect(records).toEqual([
      'provider',
      'consumer:1',
      'consumer disposed',
      'provider disposed',
    ]);
    expect(app.inspect().services).toBe(0);
  });

  it('rolls back active and partially initialized scopes', async () => {
    const records: string[] = [];
    const app = createThreeApp(createAppOptions(createCanvas()));

    app.use({
      name: 'first',
      setup(context) {
        context.addCleanup(() => {
          records.push('first disposed');
        });
      },
    });
    app.use({
      name: 'failing',
      setup(context) {
        context.addCleanup(() => {
          records.push('partial disposed');
        });
        throw new Error('setup failed');
      },
    });

    await expect(app.start()).rejects.toThrow(
      'Failed to initialize feature "failing"',
    );
    expect(app.state).toBe('failed');
    expect(records).toEqual(['partial disposed', 'first disposed']);
  });

  it('requires declared services to be provided', async () => {
    const Service = createServiceKey<object>('service');
    const app = createThreeApp(createAppOptions(createCanvas()));
    app.use({
      name: 'provider',
      provides: [Service],
      setup() {},
    });

    await expect(app.start()).rejects.toThrow(/did not provide service/);
  });

  it('rejects undeclared service injection', async () => {
    const Service = createServiceKey<object>('service');
    const app = createThreeApp(createAppOptions(createCanvas()));
    app.use({
      name: 'provider',
      provides: [Service],
      setup(context) {
        context.provide(Service, {});
      },
    });
    app.use({
      name: 'consumer',
      setup(context) {
        context.inject(Service);
      },
    });

    await expect(app.start()).rejects.toThrow(/injected undeclared service/);
  });

  it('returns the same promise for concurrent start calls', async () => {
    let releaseSetup: (() => void) | undefined;
    const setupGate = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    const app = createThreeApp(createAppOptions(createCanvas()));
    app.use({
      name: 'async',
      async setup() {
        await setupGate;
      },
    });

    const first = app.start();
    const second = app.start();

    expect(first).toBe(second);
    releaseSetup?.();
    await first;
  });

  it('aborts startup when disposed during setup', async () => {
    const cleanup = vi.fn();
    const app = createThreeApp(createAppOptions(createCanvas()));
    app.use({
      name: 'waiting',
      async setup(context) {
        context.addCleanup(cleanup);
        await new Promise<void>((resolve) => {
          context.signal.addEventListener('abort', () => resolve(), {
            once: true,
          });
        });
      },
    });

    const start = app.start();
    const dispose = app.dispose();

    await expect(start).rejects.toThrow();
    await dispose;

    expect(cleanup).toHaveBeenCalledOnce();
    expect(app.state).toBe('disposed');
  });

  it('auto-disposes provided services', async () => {
    const dispose = vi.fn();
    const Service = createServiceKey<Disposable>('disposable');
    const app = createThreeApp(createAppOptions(createCanvas()));
    app.use({
      name: 'provider',
      provides: [Service],
      setup(context) {
        context.provide(Service, { dispose });
      },
    });

    await app.start();
    const firstDispose = app.dispose();
    const secondDispose = app.dispose();

    expect(firstDispose).toBe(secondDispose);
    await firstDispose;
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('locks feature registration after start', async () => {
    const app = createThreeApp(createAppOptions(createCanvas()));
    await app.start();

    expect(() =>
      app.use({
        name: 'late',
        setup() {},
      }),
    ).toThrow(/Cannot register feature/);

    await app.dispose();
  });
});
