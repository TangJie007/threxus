import { describe, expect, it, vi } from 'vitest';
import {
  ThrexusError,
  createExampleComposerPipeline,
  createThreeApp,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('M10 WebGL context lost/restore', () => {
  it('pauses rendering on lost while keeping AppState running', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    const lost: string[] = [];

    app.use({
      name: 'listener',
      setup(context) {
        context.onContextLost(() => {
          lost.push('lost');
        });
      },
    });

    await app.start();
    expect(app.state).toBe('running');
    expect(app.graphicsState).toBe('available');

    app.render();
    expect(options.renderer.render).toHaveBeenCalledTimes(1);

    app.simulateContextLost();
    expect(app.graphicsState).toBe('lost');
    expect(app.state).toBe('running');
    expect(lost).toEqual(['lost']);

    app.render();
    expect(options.renderer.render).toHaveBeenCalledTimes(1);

    await app.simulateContextRestored();
    expect(app.graphicsState).toBe('available');
    // restore 会 requestFullRender
    expect(options.renderer.render).toHaveBeenCalledTimes(2);

    await app.dispose();
  });

  it('keeps paused AppState after restore', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    app.use({ name: 'noop', setup() {} });
    await app.start();
    app.pause();
    expect(app.state).toBe('paused');

    app.simulateContextLost();
    expect(app.graphicsState).toBe('lost');
    await app.simulateContextRestored();
    expect(app.graphicsState).toBe('available');
    expect(app.state).toBe('paused');

    await app.dispose();
  });

  it('runs feature restore in install order and pipeline.restore', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    const order: string[] = [];
    const pipeline = createExampleComposerPipeline({
      onRestore: () => {
        order.push('pipeline');
      },
    });

    app.use({
      name: 'a',
      setup(context) {
        context.rendering.setPipeline(pipeline);
        context.onContextRestored(() => {
          order.push('a');
        });
      },
    });
    app.use({
      name: 'b',
      setup(context) {
        context.onContextRestored(async () => {
          order.push('b');
        });
      },
    });

    await app.start();
    app.simulateContextLost();
    await app.simulateContextRestored();
    expect(pipeline.restored).toBe(true);
    expect(order).toEqual(['pipeline', 'a', 'b']);
    await app.dispose();
  });

  it('marks unavailable when feature restore fails', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    app.use({
      name: 'bad',
      setup(context) {
        context.onContextRestored(() => {
          throw new Error('feature-restore-fail');
        });
      },
    });

    await app.start();
    app.simulateContextLost();
    await expect(app.simulateContextRestored()).rejects.toBeInstanceOf(
      ThrexusError,
    );
    expect(app.graphicsState).toBe('unavailable');
    expect(app.state).toBe('running');

    await app.dispose();
    expect(app.state).toBe('disposed');
  });

  it('allows dispose while restoring', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    app.use({
      name: 'slow',
      setup(context) {
        context.onContextRestored(async () => {
          await gate;
        });
      },
    });

    await app.start();
    app.simulateContextLost();
    const restoring = app.simulateContextRestored();
    const disposing = app.dispose();
    release();
    await Promise.allSettled([restoring, disposing]);
    expect(app.state).toBe('disposed');
  });

  it('marks unavailable when pipeline restore fails', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    const pipeline = createExampleComposerPipeline({
      onRestore: () => {
        throw new Error('pipeline-fail');
      },
    });

    app.use({
      name: 'composer',
      setup(context) {
        context.rendering.setPipeline(pipeline);
      },
    });

    await app.start();
    app.simulateContextLost();
    await expect(app.simulateContextRestored()).rejects.toThrow(/pipeline-fail/);
    expect(app.graphicsState).toBe('unavailable');
    await app.dispose();
  });
});
