import { PerspectiveCamera } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createOrthographicCamera, createPerspectiveCamera } from '../../src/rendering/CameraFactory';
import { resolvePixelRatio } from '../../src/rendering/PixelRatioController';
import { ResizeController } from '../../src/rendering/ResizeController';
import { createMockRenderer, createTestCanvas } from '../helpers/headless-three';

describe('resolvePixelRatio', () => {
  it('caps device pixel ratio by default max', () => {
    vi.stubGlobal('window', { devicePixelRatio: 3 });
    expect(resolvePixelRatio('device')).toBe(2);
    vi.unstubAllGlobals();
  });

  it('respects explicit numeric ratio', () => {
    expect(resolvePixelRatio(1.5)).toBe(1.5);
  });

  it('respects policy max', () => {
    vi.stubGlobal('window', { devicePixelRatio: 4 });
    expect(resolvePixelRatio({ mode: 'device', max: 1.5 })).toBe(1.5);
    vi.unstubAllGlobals();
  });
});

describe('CameraFactory', () => {
  it('creates perspective camera with aspect', () => {
    const camera = createPerspectiveCamera(
      { type: 'perspective', fov: 45, position: [1, 2, 3] },
      2,
    );
    expect(camera.fov).toBe(45);
    expect(camera.aspect).toBe(2);
    expect(camera.position.z).toBe(3);
  });

  it('creates orthographic camera with frustum size', () => {
    const camera = createOrthographicCamera(
      { type: 'orthographic', frustumSize: 20 },
      2,
    );
    expect(camera.right - camera.left).toBe(40);
    expect(camera.top - camera.bottom).toBe(20);
  });
});

describe('ResizeController', () => {
  it('updates perspective camera aspect and renderer size', () => {
    const canvas = createTestCanvas();
    const renderer = createMockRenderer(canvas);
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const controller = new ResizeController({
      canvas,
      renderer,
      getCamera: () => camera,
      getPixelRatio: () => 1,
    });

    const size = controller.apply();

    expect(size.width).toBe(640);
    expect(size.height).toBe(480);
    expect(renderer.setSize).toHaveBeenCalledWith(640, 480, false);
    expect(camera.aspect).toBeCloseTo(640 / 480);
  });

  it('handles zero canvas size without rendering', () => {
    const canvas = {
      clientWidth: 0,
      clientHeight: 0,
      style: {},
    } as HTMLCanvasElement;
    const renderer = createMockRenderer(canvas);
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    const controller = new ResizeController({
      canvas,
      renderer,
      getCamera: () => camera,
      getPixelRatio: () => 1,
    });

    controller.apply();
    expect(controller.canRender).toBe(false);
    expect(renderer.setSize).not.toHaveBeenCalled();
  });
});
