import { afterEach, describe, expect, it } from 'vitest';
import {
  ManualRafDriver,
  QualityService,
  createThreeApp,
  qualityFeature,
  type QualityServiceType,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('medium features', () => {
  const apps: Array<{ dispose: () => Promise<void> }> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.dispose();
    }
  });

  it('installFeature / uninstallFeature while running', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    apps.push(app);
    await app.start();

    let alive = false;
    await app.installFeature({
      name: 'dynamic-probe',
      setup(context) {
        alive = true;
        context.addCleanup(() => {
          alive = false;
        });
      },
    });
    expect(alive).toBe(true);
    expect(app.inspect().features.some((f) => f.name === 'dynamic-probe')).toBe(
      true,
    );

    await app.uninstallFeature('dynamic-probe');
    expect(alive).toBe(false);
    expect(
      app.inspect().features.some((f) => f.name === 'dynamic-probe'),
    ).toBe(false);
  });

  it('rejects installFeature when required service is missing', async () => {
    const app = createThreeApp(createHeadlessThreeAppOptions());
    apps.push(app);
    await app.start();

    await expect(
      app.installFeature({
        name: 'needs-quality',
        dependencies: [QualityService],
        setup() {
          // unreachable
        },
      }),
    ).rejects.toThrow(/missing required service/i);
  });

  it('qualityFeature switches pixel ratio override', async () => {
    const driver = new ManualRafDriver();
    const options = createHeadlessThreeAppOptions();
    const app = createThreeApp({
      ...options,
      rafDriver: driver,
      pixelRatio: 2,
    });
    apps.push(app);

    let quality!: QualityServiceType;
    app.use(
      qualityFeature({
        tiers: [
          { id: 'high', pixelRatio: 2 },
          { id: 'low', pixelRatio: 1 },
        ],
        initialTierId: 'high',
      }),
    );
    app.use({
      name: 'probe',
      dependencies: [QualityService],
      setup(context) {
        quality = context.inject(QualityService);
      },
    });

    await app.start();
    expect(quality.tierId).toBe('high');
    quality.setTier('low');
    expect(quality.tierId).toBe('low');
    expect(options.renderer.setPixelRatio).toHaveBeenCalled();
  });
});
