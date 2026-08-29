import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createThreeApp,
  ManualRafDriver,
  Scheduler,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';
import { resetSchedulerTaskIdsForTests } from '../../src/scheduler/SchedulerTask';

function createCanvas(): HTMLCanvasElement {
  return {} as HTMLCanvasElement;
}

describe('Scheduler', () => {
  beforeEach(() => {
    resetSchedulerTaskIdsForTests();
  });

  it('runs update tasks by priority with stable order', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      shouldRun: () => true,
    });
    const order: string[] = [];

    scheduler.onUpdate('a', () => order.push('a'), { priority: 0 });
    scheduler.onUpdate('b', () => order.push('b'), { priority: -1 });
    scheduler.onUpdate('c', () => order.push('c'), { priority: 0 });

    scheduler.start();
    driver.tick(16);

    expect(order).toEqual(['b', 'a', 'c']);
  });

  it('defers tasks registered during execution to the next frame', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      shouldRun: () => true,
    });
    const order: string[] = [];

    scheduler.onUpdate('parent', () => {
      order.push('parent');
      scheduler.onUpdate('child', () => order.push('child'));
    });

    scheduler.start();
    driver.tick(16);
    expect(order).toEqual(['parent']);

    driver.tick(32);
    expect(order.filter((entry) => entry === 'child')).toEqual(['child']);
    expect(order.filter((entry) => entry === 'parent').length).toBe(2);
  });

  it('skips tasks disposed during execution in the same frame', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      shouldRun: () => true,
    });
    const order: string[] = [];
    let disposeSecond: (() => void) | undefined;

    scheduler.onUpdate('first', () => {
      order.push('first');
      disposeSecond?.();
    });
    disposeSecond = scheduler.onUpdate('second', () => {
      order.push('second');
    }).dispose;

    scheduler.start();
    driver.tick(16);

    expect(order).toEqual(['first']);
  });

  it('clamps oversized delta', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      maxDelta: 0.1,
      shouldRun: () => true,
    });
    const deltas: number[] = [];

    scheduler.onUpdate('probe', ({ delta }) => deltas.push(delta));
    scheduler.start();
    driver.tick(0);
    driver.tick(500);

    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBe(0.1);
  });

  it('runs fixed updates with a per-frame iteration cap', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      fixedStep: 0.016,
      maxFixedStepsPerFrame: 2,
      maxDelta: 1,
      shouldRun: () => true,
    });
    let fixedCalls = 0;

    scheduler.onFixedUpdate('physics', () => {
      fixedCalls += 1;
    });
    scheduler.start();
    driver.tick(0);
    driver.tick(200);

    expect(fixedCalls).toBe(2);
  });

  it('pauses and resumes the render loop', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      shouldRun: () => true,
    });
    let frames = 0;

    scheduler.onUpdate('counter', () => {
      frames += 1;
    });
    scheduler.start();
    driver.tick(16);
    expect(frames).toBe(1);
    expect(driver.pending).toBe(true);

    scheduler.pause();
    expect(driver.pending).toBe(false);
    driver.tick(32);
    expect(frames).toBe(1);

    scheduler.resume();
    expect(driver.pending).toBe(true);
    driver.tick(48);
    expect(frames).toBe(2);
  });

  it('coalesces invalidate calls in on-demand mode', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      renderMode: 'on-demand',
      rafDriver: driver,
      shouldRun: () => true,
    });
    let frames = 0;

    scheduler.onUpdate('counter', () => {
      frames += 1;
    });
    scheduler.start();
    expect(driver.pending).toBe(false);

    scheduler.invalidate();
    scheduler.invalidate();
    expect(driver.pending).toBe(true);

    driver.tick(16);
    expect(frames).toBe(1);
    expect(driver.pending).toBe(false);
  });

  it('does not schedule duplicate RAF callbacks in continuous mode', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      shouldRun: () => true,
    });

    scheduler.start();
    expect(driver.pending).toBe(true);
    scheduler.invalidate();
    expect(driver.pending).toBe(true);
  });

  it('stops scheduling after dispose', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      shouldRun: () => true,
    });
    let frames = 0;

    scheduler.onUpdate('counter', () => {
      frames += 1;
    });
    scheduler.start();
    driver.tick(16);
    scheduler.dispose();
    driver.tick(32);

    expect(frames).toBe(1);
    expect(driver.pending).toBe(false);
  });

  it('continues after task errors when errorPolicy is continue', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      errorPolicy: 'continue',
      shouldRun: () => true,
    });
    const order: string[] = [];

    scheduler.onUpdate('fail', () => {
      order.push('fail');
      throw new Error('boom');
    });
    scheduler.onUpdate('next', () => order.push('next'));

    scheduler.start();
    driver.tick(16);
    expect(order).toEqual(['fail', 'next']);
  });

  it('stops the current frame when errorPolicy is stop', () => {
    const driver = new ManualRafDriver();
    const scheduler = new Scheduler({
      rafDriver: driver,
      errorPolicy: 'stop',
      shouldRun: () => true,
    });
    const order: string[] = [];

    scheduler.onUpdate('fail', () => {
      order.push('fail');
      throw new Error('boom');
    });
    scheduler.onUpdate('next', () => order.push('next'));
    scheduler.onBeforeRender('before', () => order.push('before'));

    scheduler.start();
    driver.tick(16);
    expect(order).toEqual(['fail']);
  });
});

describe('ThreeApp scheduler integration', () => {
  it('starts the scheduler after app.start()', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });
    let frames = 0;

    app.use({
      name: 'counter',
      setup(context) {
        context.onUpdate(() => {
          frames += 1;
        });
      },
    });

    await app.start();
    expect(app.inspect().scheduler.running).toBe(true);
    driver.tick(16);
    expect(frames).toBe(1);

    await app.dispose();
    expect(app.inspect().scheduler.running).toBe(false);
    driver.tick(32);
    expect(frames).toBe(1);
  });

  it('pauses and resumes scheduler with app state', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });
    let frames = 0;

    app.use({
      name: 'counter',
      setup(context) {
        context.onUpdate(() => {
          frames += 1;
        });
      },
    });

    await app.start();
    driver.tick(16);
    app.pause();
    driver.tick(32);
    expect(frames).toBe(1);

    app.resume();
    driver.tick(48);
    expect(frames).toBe(2);
  });

  it('disposes app from inside an update callback', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });
    const cleanup = vi.fn();
    let disposePromise: Promise<void> | undefined;

    app.use({
      name: 'self-dispose',
      setup(context) {
        context.addCleanup(cleanup);
        context.onUpdate(() => {
          disposePromise = app.dispose();
        });
      },
    });

    await app.start();
    driver.tick(16);
    await disposePromise;
    expect(cleanup).toHaveBeenCalledOnce();
    expect(app.state).toBe('disposed');
  });
});
