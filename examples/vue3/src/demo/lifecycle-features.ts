import { createServiceKey, type ThreeFeature } from '@threxus/runtime';
import type { DemoLogger } from './types';

interface ClockService {
  now(): string;
}

const ClockService = createServiceKey<ClockService>('demo-clock');

export function createLifecycleFeatures(log: DemoLogger): ThreeFeature[] {
  return [
    {
      name: 'clock-consumer',
      dependencies: [ClockService],
      setup(context) {
        const clock = context.inject(ClockService);
        log(`2. consumer 启动并读取服务：${clock.now()}`);
        context.addCleanup(() => {
          log('3. consumer 先销毁');
        });
      },
    },
    {
      name: 'clock-provider',
      provides: [ClockService],
      setup(context) {
        log('1. provider 先启动（依赖图自动排序）');
        context.provide(ClockService, {
          now: () => new Date().toLocaleTimeString(),
        });
        context.addCleanup(() => {
          log('4. provider 后销毁');
        });
      },
    },
  ];
}
