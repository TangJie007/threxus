import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ManualRafDriver,
  LabelsService,
  PostprocessingService,
  SelectionService,
  StatsService,
  createThreeApp,
  environmentFeature,
  highlightFeature,
  labelsFeature,
  postprocessingFeature,
  selectionFeature,
  statsFeature,
  type LabelsServiceType,
  type SelectionServiceType,
  type StatsServiceType,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('M11 built-in features', () => {
  const apps: Array<{ dispose: () => Promise<void> }> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.dispose();
    }
  });

  it('environmentFeature owns lights and optional ground', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    apps.push(app);

    app.use(
      environmentFeature({
        background: 0x102030,
        ground: { size: 10 },
      }),
    );

    await app.start();
    expect(options.scene.getObjectByName('environment-ambient')).toBeTruthy();
    expect(options.scene.getObjectByName('environment-key-light')).toBeTruthy();
    expect(options.scene.getObjectByName('environment-ground')).toBeTruthy();
  });

  it('selectionFeature updates SelectionService', async () => {
    const options = createHeadlessThreeAppOptions();
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    options.scene.add(mesh);

    const app = createThreeApp(options);
    apps.push(app);
    let service!: SelectionServiceType;

    app.use(selectionFeature({ roots: [mesh] }));
    app.use({
      name: 'consumer',
      dependencies: [SelectionService],
      setup(context) {
        service = context.inject(SelectionService);
      },
    });

    await app.start();
    service.select(mesh);
    expect(service.isSelected(mesh)).toBe(true);
    service.clear();
    expect(service.selected).toHaveLength(0);
  });

  it('highlightFeature reacts to selection changes', async () => {
    const options = createHeadlessThreeAppOptions();
    const material = new MeshStandardMaterial({ color: 0xffffff });
    const mesh = new Mesh(new BoxGeometry(), material);
    options.scene.add(mesh);

    const app = createThreeApp(options);
    apps.push(app);

    app.use(selectionFeature({ roots: [mesh] }));
    app.use(highlightFeature({ emissive: 0xff0000, emissiveIntensity: 0.8 }));

    let selection!: SelectionServiceType;
    app.use({
      name: 'probe',
      dependencies: [SelectionService],
      setup(context) {
        selection = context.inject(SelectionService);
      },
    });

    await app.start();
    const before = material.emissive.getHex();
    selection.select(mesh);
    expect(material.emissive.getHex()).toBe(0xff0000);
    expect(material.emissiveIntensity).toBe(0.8);
    selection.clear();
    expect(material.emissive.getHex()).toBe(before);
  });

  it('statsFeature samples renderer and asset metrics', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });
    apps.push(app);

    let stats!: StatsServiceType;
    app.use(statsFeature());
    app.use({
      name: 'probe',
      dependencies: [StatsService],
      setup(context) {
        stats = context.inject(StatsService);
      },
    });

    await app.start();
    driver.tick(16);
    const sample = stats.sample();
    expect(sample.pipeline).toBe('direct');
    expect(stats.latest).not.toBeNull();
  });

  it('postprocessingFeature owns pipeline and accepts ordered passes', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    apps.push(app);
    const order: string[] = [];

    app.use(postprocessingFeature());
    app.use({
      name: 'fx',
      dependencies: [PostprocessingService],
      setup(context) {
        const post = context.inject(PostprocessingService);
        context.addCleanup(
          post.addPass({
            id: 'b',
            priority: 10,
            render: () => order.push('b'),
          }),
        );
        context.addCleanup(
          post.addPass({
            id: 'a',
            priority: 0,
            render: () => order.push('a'),
          }),
        );
      },
    });

    await app.start();
    expect(app.inspect().rendering?.pipeline).toBe('postprocessing');
    app.render();
    expect(order).toEqual(['a', 'b']);
    expect(options.renderer.render).toHaveBeenCalled();
  });

  it('postprocessing restore invokes pass.restore', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    apps.push(app);
    const restored: string[] = [];

    app.use(postprocessingFeature());
    app.use({
      name: 'fx',
      dependencies: [PostprocessingService],
      setup(context) {
        context.inject(PostprocessingService).addPass({
          id: 'outline',
          render: () => undefined,
          restore: () => {
            restored.push('outline');
          },
        });
      },
    });

    await app.start();
    app.simulateContextLost();
    await app.simulateContextRestored();
    expect(restored).toEqual(['outline']);
  });

  it('labelsFeature provides LabelsService', async () => {
    if (typeof document === 'undefined') {
      return;
    }
    const options = createHeadlessThreeAppOptions();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = createThreeApp(options);
    apps.push(app);

    let labels!: LabelsServiceType;
    app.use(labelsFeature({ container: host }));
    app.use({
      name: 'probe',
      dependencies: [LabelsService],
      setup(context) {
        labels = context.inject(LabelsService);
      },
    });

    await app.start();
    const el = document.createElement('div');
    el.textContent = 'AGV-1';
    const handle = labels.add({
      id: 'agv-1',
      anchor: { x: 0, y: 1, z: 0 },
      element: el,
    });
    expect(labels.size).toBe(1);
    handle.dispose();
    expect(labels.size).toBe(0);
    host.remove();
  });

  it('environmentFeature can enable shadows and ground receiveShadow', async () => {
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp(options);
    apps.push(app);

    app.use(
      environmentFeature({
        ground: { size: 40, receiveShadow: true },
        shadows: {
          enabled: true,
          mapSize: 1024,
          fitBounds: { width: 40, depth: 30, height: 20 },
        },
      }),
    );

    await app.start();
    expect(options.renderer.shadowMap.enabled).toBe(true);
    const light = options.scene.getObjectByName('environment-key-light') as
      | import('three').DirectionalLight
      | undefined;
    expect(light?.castShadow).toBe(true);
    expect(light?.shadow.camera.left).toBe(-20);
  });
});
