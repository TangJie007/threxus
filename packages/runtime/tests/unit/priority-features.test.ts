import { afterEach, describe, expect, it } from 'vitest';
import {
  CameraRigService,
  ManualRafDriver,
  cameraRigFeature,
  createThreeApp,
  orbitControlsFeature,
  type CameraRigServiceType,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('priority features (unit)', () => {
  const apps: Array<{ dispose: () => Promise<void> }> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()?.dispose();
    }
  });

  it('cameraRigFeature flyTo completes and re-enables controls', async () => {
    const driver = new ManualRafDriver();
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      rafDriver: driver,
    });
    apps.push(app);

    let rig!: CameraRigServiceType;
    app.use(orbitControlsFeature());
    app.use(cameraRigFeature());
    app.use({
      name: 'probe',
      dependencies: [CameraRigService],
      setup(context) {
        rig = context.inject(CameraRigService);
      },
    });

    await app.start();
    expect(rig.busy).toBe(false);
    rig.flyTo([0, 0, 0], { duration: 0.05, distance: 5, height: 2 });
    expect(rig.busy).toBe(true);
    for (let i = 1; i <= 10; i += 1) {
      driver.tick(i * 20);
    }
    expect(rig.busy).toBe(false);
  });
});
