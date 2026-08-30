import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  ManualRafDriver,
  defineEntity,
  defineFeature,
  defineService,
  createThreeApp,
  type EntityHandle,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('runtime definitions', () => {
  it('defines a frozen feature and validates its name eagerly', async () => {
    const feature = defineFeature({
      name: 'defined-feature',
      setup() {},
    });
    const app = createThreeApp(createHeadlessThreeAppOptions());

    expect(Object.isFrozen(feature)).toBe(true);
    expect(() => defineFeature({ name: ' ', setup() {} })).toThrow(
      /non-empty/,
    );

    app.use(feature);
    await app.start();
    expect(app.inspect().features[0]?.name).toBe('defined-feature');
    await app.dispose();
  });

  it('defines a typed service provider and exposes service metadata', async () => {
    const dispose = vi.fn();
    const CounterService = defineService<
      { value: number; dispose(): void },
      { initial: number }
    >({
      name: 'counter',
      featureName: 'counter-provider',
      create(_context, options) {
        return { value: options.initial, dispose };
      },
    });
    let injected = 0;
    const app = createThreeApp(createHeadlessThreeAppOptions());

    app.use({
      name: 'counter-consumer',
      dependencies: [CounterService],
      setup(context) {
        injected = context.inject(CounterService).value;
      },
    });
    app.use(CounterService.feature({ initial: 4 }));

    await app.start();

    expect(injected).toBe(4);
    expect(app.inspect().counts).toMatchObject({
      features: 2,
      activeFeatures: 2,
      services: 1,
      entities: 0,
    });
    expect(app.inspect().serviceEntries).toEqual([
      { name: 'counter', ownerFeature: 'counter-provider' },
    ]);

    await app.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(app.inspect().services).toBe(0);
  });

  it('spawns, updates, inspects, and explicitly disposes an entity', async () => {
    const raf = new ManualRafDriver();
    const dispose = vi.fn();
    const update = vi.fn();
    const Machine = defineEntity<
      { name: string },
      { readonly status: string }
    >({
      type: 'machine',
      create(_context, props) {
        const root = new Group();
        root.name = props.name;
        return {
          root,
          api: { status: 'running' },
          update,
          dispose,
        };
      },
    });
    let machine: EntityHandle<{ readonly status: string }> | undefined;
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: raf,
    });
    app.use({
      name: 'factory',
      async setup(context) {
        machine = await context.spawn(
          Machine,
          { name: 'M-01' },
          { id: 'machine-01' },
        );
      },
    });

    await app.start();

    expect(machine?.root.parent).toBe(app.scene);
    expect(machine?.api.status).toBe('running');
    expect(app.inspect().entities).toEqual([
      {
        id: 'machine-01',
        type: 'machine',
        state: 'active',
        ownerFeature: 'factory',
      },
    ]);

    raf.tick(16);
    expect(update).toHaveBeenCalledOnce();

    await machine?.dispose();
    expect(machine?.root.parent).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
    expect(app.inspect().counts.entities).toBe(0);

    await app.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('removes spawned entities when a dynamic feature is uninstalled', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    const Device = defineEntity({
      type: 'device',
      create() {
        return { root: new Group() };
      },
    });

    await app.start();
    await app.installFeature({
      name: 'devices',
      async setup(context) {
        await context.spawn(Device, undefined);
        await context.spawn(Device, undefined);
      },
    });

    expect(app.inspect().counts.entities).toBe(2);
    await app.uninstallFeature('devices');
    expect(app.inspect().counts.entities).toBe(0);
    expect(app.scene.children).toHaveLength(0);

    await app.dispose();
  });

  it('aborts an asynchronous entity create when the app is disposed', async () => {
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const AsyncEntity = defineEntity({
      type: 'async',
      async create(context) {
        markStarted?.();
        await new Promise<void>((_resolve, reject) => {
          context.signal.addEventListener(
            'abort',
            () => reject(context.signal.reason),
            { once: true },
          );
        });
        return { root: new Group() };
      },
    });
    const app = createThreeApp(createHeadlessThreeAppOptions());
    app.use({
      name: 'async-owner',
      async setup(context) {
        await context.spawn(AsyncEntity, undefined);
      },
    });

    const start = app.start();
    await started;
    const disposing = app.dispose();

    await expect(start).rejects.toThrow(/Failed to create entity/);
    await disposing;
    expect(app.inspect().counts.entities).toBe(0);
    expect(app.state).toBe('disposed');
  });

  it('rolls back an earlier entity when a duplicate id is spawned', async () => {
    const dispose = vi.fn();
    const Item = defineEntity({
      type: 'item',
      create() {
        return { root: new Group(), dispose };
      },
    });
    const app = createThreeApp(createHeadlessThreeAppOptions());
    app.use({
      name: 'items',
      async setup(context) {
        await context.spawn(Item, undefined, { id: 'same' });
        await context.spawn(Item, undefined, { id: 'same' });
      },
    });

    await expect(app.start()).rejects.toThrow(/already registered/);
    expect(dispose).toHaveBeenCalledOnce();
    expect(app.inspect().counts.entities).toBe(0);

    await app.dispose();
  });
});
