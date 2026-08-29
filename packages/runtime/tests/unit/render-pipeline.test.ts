import { Color, Vector4 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  RenderPipelineService,
  ThrexusError,
  createExampleComposerPipeline,
  createThreeApp,
  type RenderStage,
} from '../../src';
import {
  captureRendererState,
  restoreRendererState,
} from '../../src/rendering/RendererStateGuard';
import { RenderOperationQueue } from '../../src/rendering/RenderOperationQueue';
import { RenderingRegistry } from '../../src/rendering/RenderingRegistry';
import { DirectRenderPipeline } from '../../src/rendering/DirectRenderPipeline';
import {
  createHeadlessThreeAppOptions,
  createMockRenderer,
  createTestCanvas,
} from '../helpers/headless-three';

describe('RendererStateGuard', () => {
  it('restores render target, viewport and clear state', () => {
    const renderer = createMockRenderer(createTestCanvas());
    renderer.setClearColor(new Color(0.1, 0.2, 0.3), 0.5);
    renderer.setViewport(0, 0, 100, 50);
    renderer.autoClear = true;

    const snapshot = captureRendererState(renderer);

    renderer.setClearColor(new Color(1, 0, 0), 1);
    renderer.setViewport(10, 20, 30, 40);
    renderer.setRenderTarget({ id: 'temp' } as never);
    renderer.autoClear = false;

    restoreRendererState(renderer, snapshot);

    expect(renderer.getRenderTarget()).toBeNull();
    expect(renderer.autoClear).toBe(true);
    const viewport = new Vector4();
    renderer.getViewport(viewport);
    expect(viewport.toArray()).toEqual([0, 0, 100, 50]);
    const color = new Color();
    renderer.getClearColor(color);
    expect(color.r).toBeCloseTo(0.1);
    expect(renderer.getClearAlpha()).toBeCloseTo(0.5);
  });
});

describe('RenderOperationQueue', () => {
  it('runs exclusive tasks after the frame releases the lock', async () => {
    const queue = new RenderOperationQueue();
    const order: string[] = [];

    const exclusive = queue.runExclusive(async () => {
      order.push('exclusive-start');
      await Promise.resolve();
      order.push('exclusive-end');
      return 1;
    });

    expect(queue.runFrame(() => order.push('frame'))).toBe(false);
    await exclusive;
    expect(queue.runFrame(() => order.push('frame'))).toBe(true);
    expect(order).toEqual(['exclusive-start', 'exclusive-end', 'frame']);
  });
});

describe('RenderingRegistry', () => {
  it('sorts stages by priority then registration order', () => {
    const registry = new RenderingRegistry(new DirectRenderPipeline());
    const names: string[] = [];

    const make = (name: string, priority: number): RenderStage => ({
      name,
      stage: 'overlay',
      priority,
      render: () => {
        names.push(name);
      },
    });

    registry.addStage(make('b', 10), 'f1');
    registry.addStage(make('a', 0), 'f1');
    registry.addStage(make('c', 10), 'f1');

    for (const stage of registry.stagesFor('overlay')) {
      stage.render({} as never);
    }

    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('rejects duplicate pipeline owners', () => {
    const registry = new RenderingRegistry(new DirectRenderPipeline());
    const pipeline = createExampleComposerPipeline();
    registry.setPipeline(pipeline, 'post');
    expect(() => registry.setPipeline(pipeline, 'other')).toThrow(ThrexusError);
  });
});

describe('ctx.rendering', () => {
  it('rejects a second setPipeline and restores default on dispose', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    const first = createExampleComposerPipeline({ name: 'first' });
    const second = createExampleComposerPipeline({ name: 'second' });

    app.use({
      name: 'post-a',
      provides: [RenderPipelineService],
      setup(context) {
        context.rendering.setPipeline(first);
        context.provide(RenderPipelineService, first, { dispose: 'manual' });
      },
    });
    app.use({
      name: 'post-b',
      setup(context) {
        expect(() => context.rendering.setPipeline(second)).toThrow(
          /already owned/,
        );
      },
    });

    await app.start();
    expect(app.inspect().rendering?.pipeline).toBe('first');
    expect(app.inspect().rendering?.pipelineOwner).toBe('post-a');

    app.render();
    expect(first.renderCount).toBe(1);

    await app.dispose();
    expect(first.disposed).toBe(true);
  });

  it('runs stages around the main pipeline in phase order', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    const order: string[] = [];

    app.use({
      name: 'stages',
      setup(context) {
        context.rendering.addStage({
          name: 'before',
          stage: 'before-main-render',
          render: () => order.push('before'),
        });
        context.rendering.addStage({
          name: 'after',
          stage: 'after-main-render',
          render: () => order.push('after'),
        });
        context.rendering.addStage({
          name: 'overlay',
          stage: 'overlay',
          render: () => order.push('overlay'),
        });
      },
    });

    await app.start();
    app.render();
    expect(order).toEqual(['before', 'after', 'overlay']);
    expect(options.renderer.render).toHaveBeenCalledTimes(1);
    expect(app.inspect().rendering?.stages).toBe(3);

    await app.dispose();
    expect(app.inspect().rendering).toBeNull();
  });

  it('notifies pipeline setSize on camera replace', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    const pipeline = createExampleComposerPipeline();

    app.use({
      name: 'composer',
      setup(context) {
        context.rendering.setPipeline(pipeline);
      },
    });

    await app.start();
    const sizesBefore = pipeline.sizes.length;
    app.setCamera(options.camera.clone());
    expect(pipeline.sizes.length).toBeGreaterThan(sizesBefore);

    await app.dispose();
  });

  it('restores renderer state after withRendererState even on throw', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    let saw = false;

    app.use({
      name: 'guard',
      async setup(context) {
        context.renderer.autoClear = true;
        await expect(
          context.rendering.withRendererState(async (renderer) => {
            renderer.autoClear = false;
            saw = true;
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');
        expect(context.renderer.autoClear).toBe(true);
      },
    });

    await app.start();
    expect(saw).toBe(true);
    await app.dispose();
  });

  it('restores renderer state when a stage throws', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);

    app.use({
      name: 'bad-stage',
      setup(context) {
        context.renderer.autoClear = true;
        context.rendering.addStage({
          name: 'explode',
          stage: 'before-main-render',
          render(ctx) {
            ctx.renderer.autoClear = false;
            throw new Error('stage-fail');
          },
        });
      },
    });

    await app.start();
    expect(() => app.render()).toThrow('stage-fail');
    expect(options.renderer.autoClear).toBe(true);
    await app.dispose();
  });

  it('rejects duplicate RenderPipelineService providers at graph resolve', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    app.use({
      name: 'a',
      provides: [RenderPipelineService],
      setup(context) {
        context.provide(RenderPipelineService, createExampleComposerPipeline());
      },
    });
    app.use({
      name: 'b',
      provides: [RenderPipelineService],
      setup(context) {
        context.provide(RenderPipelineService, createExampleComposerPipeline());
      },
    });

    await expect(app.start()).rejects.toThrow(/declared by both/);
  });

  it('skips frame while exclusive withRendererState is running', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let exclusive!: Promise<void>;

    app.use({
      name: 'exclusive',
      setup(context) {
        exclusive = context.rendering.withRendererState(async () => {
          await gate;
        });
      },
    });

    await app.start();
    app.render();
    expect(options.renderer.render).not.toHaveBeenCalled();

    release();
    await exclusive;
    app.render();
    expect(options.renderer.render).toHaveBeenCalledTimes(1);
    await app.dispose();
  });
});
