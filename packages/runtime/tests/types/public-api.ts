import {
  createServiceKey,
  createThreeApp,
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
  },
};

const consumer: ThreeFeature = {
  name: 'clock-consumer',
  dependencies: [Clock],
  setup(context) {
    const value: number = context.inject(Clock).now();
    void value;
  },
};

declare const canvas: HTMLCanvasElement;

const app = createThreeApp({ canvas });
app.use(provider).use(consumer);
void app.start();
