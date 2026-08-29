import {
  createServiceKey,
  type ThreeFeature,
} from '@threxus/runtime';

export type DemoLogger = (message: string) => void;

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

export function createRollbackFeatures(log: DemoLogger): ThreeFeature[] {
  return [
    {
      name: 'stable-feature',
      setup(context) {
        log('1. stable-feature 启动成功');
        context.addCleanup(() => {
          log('4. stable-feature 已回滚');
        });
      },
    },
    {
      name: 'failing-feature',
      setup(context) {
        log('2. failing-feature 开始初始化');
        context.addCleanup(() => {
          log('3. failing-feature 部分资源已清理');
        });
        throw new Error('用于演示的初始化失败');
      },
    },
  ];
}
