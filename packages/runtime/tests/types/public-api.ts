import {
  createThreeApp,
  createServiceKey,
  defineEntity,
  defineFeature,
  defineService,
  type EntityHandle,
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

const DefinedClock = defineService<ClockService>({
  name: 'defined-clock',
  create() {
    return { now: () => 1 };
  },
});

const ModelEntity = defineEntity<
  { readonly id: string },
  { readonly select: () => void }
>({
  type: 'model',
  create(_context, props) {
    void props.id;
    return {
      root: mesh,
      api: { select: () => undefined },
    };
  },
});

const app = createThreeApp({ canvas, renderer, renderMode: 'on-demand', resize: false });
app.use(provider).use(consumer).use(DefinedClock.feature());
void app.start();

const interactive: ThreeFeature = defineFeature({
  name: 'interactive',
  async setup(context) {
    const entity: EntityHandle<{ readonly select: () => void }> =
      await context.spawn(ModelEntity, { id: 'model-1' });
    entity.api.select();

    const disposable = context.input.on(mesh, 'click', (event) => {
      void event.object;
      void event.point;
      event.stopPropagation();
    });
    disposable.dispose();

    context.rendering.addStage({
      name: 'labels',
      stage: 'overlay',
      priority: 0,
      render(renderContext) {
        void renderContext.renderer;
      },
    });
  },
});
void interactive;
