import { describe, expect, it } from 'vitest';
import {
  createDeferredTestLoader,
  createThreeApp,
} from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('ThreeApp assets integration', () => {
  it('retain releases handle when feature disposes', async () => {
    const loader = createDeferredTestLoader<{ ok: boolean }>('tex');
    let disposed = 0;
    loader.dispose = () => {
      disposed += 1;
    };

    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(),
      assets: {
        releaseDelayMs: 0,
        registerDefaultLoaders: false,
        loaders: [loader],
      },
    });

    app.use({
      name: 'asset-user',
      async setup(context) {
        const pending = context.assets.acquire('tex', '/shared.png');
        loader.resolve({ ok: true });
        const handle = await pending;
        context.retain(handle);
        expect(handle.value.ok).toBe(true);
      },
    });

    await app.start();
    expect(app.inspect().assets.totalRefs).toBe(1);

    await app.dispose();
    expect(disposed).toBe(1);
    expect(app.inspect().assets.disposed).toBe(true);
  });
});
