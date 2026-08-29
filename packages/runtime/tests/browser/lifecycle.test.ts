import { describe, expect, it } from 'vitest';
import { createThreeApp } from '../../src';

describe('browser lifecycle', () => {
  it('starts and disposes with a real canvas', async () => {
    const canvas = document.createElement('canvas');
    const events: string[] = [];
    const app = createThreeApp({ canvas });

    app.use({
      name: 'browser-feature',
      setup(context) {
        events.push('setup');
        context.addCleanup(() => {
          events.push('dispose');
        });
      },
    });

    await app.start();
    await app.dispose();

    expect(events).toEqual(['setup', 'dispose']);
    expect(app.state).toBe('disposed');
  });
});
