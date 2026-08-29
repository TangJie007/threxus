import {
  createThreeApp,
  createServiceKey,
  type ThreeFeature,
} from '../../src';

interface ClockService {
  now(): number;
}

const Clock = createServiceKey<ClockService>('clock');

const provider: ThreeFeature = {
  name: 'clock-provider',
  provides: [Clock],
  setup(context) {
    context.provide(Clock, {
      now: () => 0,
    });
    context.onUpdate(({ frame }) => {
      void frame;
    });
  },
};

const consumer: ThreeFeature = {
  name: 'clock-consumer',
  dependencies: [Clock],
  setup(context) {
    const value: number = context.inject(Clock).now();
    void value;
    context.invalidate();
  },
};

declare const canvas: HTMLCanvasElement;
declare const renderer: import('three').WebGLRenderer;
declare const mesh: import('three').Object3D;

const app = createThreeApp({ canvas, renderer, renderMode: 'on-demand', resize: false });
app.use(provider).use(consumer);
void app.start();

const interactive: ThreeFeature = {
  name: 'interactive',
  setup(context) {
    const disposable = context.input.on(mesh, 'click', (event) => {
      void event.object;
      void event.point;
      event.stopPropagation();
    });
    disposable.dispose();
  },
};
void interactive;
