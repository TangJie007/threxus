import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { vi } from 'vitest';

type Listener = EventListenerOrEventListenerObject;

export interface TestCanvas extends HTMLCanvasElement {
  readonly __listeners: Map<string, Set<Listener>>;
  dispatchTestEvent(type: string, event: Event): void;
}

export function createTestCanvas(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> = {
    left: 0,
    top: 0,
    width: 640,
    height: 480,
  },
): TestCanvas {
  const listeners = new Map<string, Set<Listener>>();

  const canvas = {
    clientWidth: rect.width,
    clientHeight: rect.height,
    style: { touchAction: '' } as CSSStyleDeclaration,
    __listeners: listeners,
    getBoundingClientRect: () =>
      ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }) as DOMRect,
    addEventListener: (type: string, listener: Listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener);
    },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
    dispatchTestEvent(type: string, event: Event) {
      for (const listener of listeners.get(type) ?? []) {
        if (typeof listener === 'function') {
          listener.call(canvas, event);
        } else {
          listener.handleEvent(event);
        }
      }
    },
  } as unknown as TestCanvas;

  return canvas;
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

export function createPointerEventLike(
  type: string,
  init: {
    pointerId?: number;
    clientX: number;
    clientY: number;
    timeStamp?: number;
  },
): PointerEvent {
  const event = {
    type,
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX,
    clientY: init.clientY,
    timeStamp: init.timeStamp ?? 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  return event as unknown as PointerEvent;
}
