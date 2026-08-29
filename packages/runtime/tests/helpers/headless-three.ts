import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { vi } from 'vitest';

export function createTestCanvas(): HTMLCanvasElement {
  return {
    clientWidth: 640,
    clientHeight: 480,
    style: {},
  } as HTMLCanvasElement;
}

/** Node 环境占位 WebGLRenderer，避免创建真实 GL 上下文。 */
export function createMockRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = Object.create(WebGLRenderer.prototype) as WebGLRenderer & {
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>;
  };

  renderer.render = vi.fn();
  renderer.dispose = vi.fn();
  renderer.setSize = vi.fn();
  renderer.setPixelRatio = vi.fn();
  Object.defineProperty(renderer, 'domElement', { value: canvas, configurable: true });
  renderer.shadowMap = { enabled: false } as WebGLRenderer['shadowMap'];

  return renderer;
}

export function createTestScene(): Scene {
  return new Scene();
}

export function createTestCamera(): PerspectiveCamera {
  return new PerspectiveCamera(50, 640 / 480, 0.1, 100);
}

export function createHeadlessThreeAppOptions(canvas = createTestCanvas()) {
  return {
    canvas,
    scene: createTestScene(),
    camera: createTestCamera(),
    renderer: createMockRenderer(canvas),
    resize: false as const,
  };
}
