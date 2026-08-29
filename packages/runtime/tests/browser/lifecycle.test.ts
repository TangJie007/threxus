import { describe, expect, it } from 'vitest';
import { createThreeApp } from '../../src';
import { createHeadlessThreeAppOptions } from '../helpers/headless-three';

describe('browser lifecycle', () => {
  it('starts and disposes with a real canvas', async () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 240, configurable: true });
    const events: string[] = [];
    const app = createThreeApp({
      ...createHeadlessThreeAppOptions(canvas),
      resize: false,
    });

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
