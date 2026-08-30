import {
  createThreeApp,
  createServiceKey,
  defineEntity,
  defineFeature,
  defineService,
  type EntityHandle,
  type Disposable,
  type MountOptions,
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

const DefinedClock = defineService<ClockService>(
  'defined-clock',
  () => ({ now: () => 1 }),
);
const definedClockProvider = defineFeature({
  name: 'defined-clock-provider',
  provides: [DefinedClock],
});
const definedClockConsumer: ThreeFeature = {
  name: 'defined-clock-consumer',
  dependencies: [DefinedClock],
  setup(context) {
    const value: number = context.inject(DefinedClock).now();
    void value;
  },
};

const ModelEntity = defineEntity<
  { readonly id: string },
  { readonly select: () => void }
>({
  type: 'model',
  create(context, props) {
    void props.id;
    const mounted: import('three').Object3D = context.mount(mesh);
    void mounted;
    return {
      root: mesh,
      api: { select: () => undefined },
    };
  },
});

const app = createThreeApp({ canvas, renderer, renderMode: 'on-demand', resize: false });
app.use(provider).use(consumer).use(definedClockProvider).use(definedClockConsumer);
void app.start();
const entityCount: number = app.entities.count;
const modelEntities: readonly EntityHandle<{
  readonly select: () => void;
}>[] = app.entities.list(ModelEntity);
void entityCount;
void modelEntities;

const interactive: ThreeFeature = defineFeature({
  name: 'interactive',
  async setup(context) {
    const mountOptions: MountOptions = { parent: context.scene };
    const mountedMesh: import('three').Object3D = context.mount(
      mesh,
      mountOptions,
    );
    const cleanupHandle: Disposable = context.mount(() => undefined);
    void mountedMesh;
    void cleanupHandle;

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
