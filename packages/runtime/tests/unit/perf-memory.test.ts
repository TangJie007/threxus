import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ManualRafDriver,
  createDeferredTestLoader,
  createThreeApp,
} from '../../src';
import {
  createHeadlessThreeAppOptions,
  createPointerEventLike,
  createTestCanvas,
  type TestCanvas,
} from '../helpers/headless-three';

function elapsedMs(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('M12 performance baselines', () => {
  it('empty scene frame stays under a soft budget', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });
    app.use({ name: 'empty', setup() {} });
    await app.start();

    const ms = elapsedMs(() => {
      for (let i = 0; i < 120; i += 1) {
        driver.tick(i * 16);
      }
    });

    expect(ms).toBeLessThan(500);
    await app.dispose();
  });

  it('scales update tasks to 1000 without catastrophic cost', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });

    app.use({
      name: 'many-updates',
      setup(context) {
        for (let i = 0; i < 1000; i += 1) {
          context.onUpdate(() => {
            // no-op workload marker
          });
        }
      },
    });

    await app.start();
    const ms = elapsedMs(() => {
      for (let i = 0; i < 30; i += 1) {
        driver.tick(i * 16);
      }
    });

    expect(app.inspect().scheduler.tasks.update).toBe(1000);
    expect(ms).toBeLessThan(2000);
    await app.dispose();
  });

  it('merges concurrent asset acquires', async () => {
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      assets: { registerDefaultLoaders: false, releaseDelayMs: 0 },
    });
    const loader = createDeferredTestLoader<string>('bench');
    app.assets.registerLoader(loader);

    app.use({
      name: 'load',
      async setup(context) {
        const pending = Promise.all([
          context.assets.acquire('bench', '/a'),
          context.assets.acquire('bench', '/a'),
          context.assets.acquire('bench', '/a'),
        ]);
        expect(loader.calls).toBe(1);
        loader.resolve('ok');
        const handles = await pending;
        expect(handles[0]!.value).toBe('ok');
        for (const handle of handles) {
          handle.dispose();
        }
      },
    });

    await app.start();
    await app.dispose();
  });
});

describe('M12 memory soak', () => {
  it('create/start/dispose 20 times leaves zero refs and listeners', async () => {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const canvas = createTestCanvas() as TestCanvas;
      const options = createHeadlessThreeAppOptions(canvas);
      const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      mesh.position.set(0, 0, -2);
      options.scene.add(mesh);
      mesh.updateMatrixWorld(true);
      options.camera.lookAt(0, 0, -1);
      options.camera.updateMatrixWorld(true);

      const app = createThreeApp(options);
      app.use({
        name: 'soak',
        setup(context) {
          context.input.on(mesh, 'click', () => undefined);
          context.own(mesh);
        },
      });

      await app.start();
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchTestEvent(
        'pointerdown',
        createPointerEventLike('pointerdown', {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          timeStamp: 0,
        }),
      );
      await app.dispose();

      expect(app.inspect().state).toBe('disposed');
      expect(app.inspect().scheduler.running).toBe(false);
      expect(app.inspect().scheduler.pendingRaf).toBe(false);
      expect(app.inspect().assets.totalRefs).toBe(0);
      expect(app.inspect().input).toBeNull();
      expect(canvas.__listeners.get('pointerdown')?.size ?? 0).toBe(0);
    }
  });
});
