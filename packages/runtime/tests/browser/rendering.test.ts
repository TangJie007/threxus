import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { describe, expect, it } from 'vitest';
import { createThreeApp } from '../../src';

describe('browser rendering', () => {
  it('renders a rotating box through the scheduler', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    Object.defineProperty(canvas, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 240, configurable: true });
    document.body.appendChild(canvas);

    let frames = 0;
    const app = createThreeApp({
      canvas,
      camera: {
        type: 'perspective',
        position: [2, 2, 4],
        target: [0, 0, 0],
      },
      scene: {
        background: new Color('#0b1220'),
      },
      resize: false,
    });

    app.use({
      name: 'rotating-box',
      setup(context) {
        const geometry = new BoxGeometry();
        const material = new MeshStandardMaterial({ color: 0x409eff });
        const mesh = new Mesh(geometry, material);
        context.scene.add(mesh);
        context.own(mesh);

        const light = new DirectionalLight(0xffffff, 2);
        light.position.set(3, 4, 5);
        context.scene.add(light);
        context.own(light);

        context.addCleanup(() => geometry.dispose());
        context.addCleanup(() => material.dispose());

        context.onUpdate(({ delta }) => {
          frames += 1;
          mesh.rotation.y += delta;
        });
      },
    });

    await app.start();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(frames).toBeGreaterThan(0);
    expect(app.inspect().rendering?.canRender).toBe(true);

    await app.dispose();
    document.body.removeChild(canvas);
  });
});
