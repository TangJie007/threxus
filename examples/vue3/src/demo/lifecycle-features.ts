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
    createSchedulerDemoFeature(log),
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

/** 用 Canvas 2D 验证 RAF 调度（M4 尚无 WebGL）。 */
function createSchedulerDemoFeature(log: DemoLogger): ThreeFeature {
  return {
    name: 'scheduler-demo',
    setup(context) {
      const canvas = context.canvas;
      const ctx2d = canvas.getContext('2d');

      const resize = (): void => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      };

      resize();
      window.addEventListener('resize', resize);
      context.addCleanup(() => {
        window.removeEventListener('resize', resize);
      });

      log('scheduler-demo 已注册 onUpdate');

      context.onUpdate(({ frame, elapsed }) => {
        if (!ctx2d) {
          return;
        }

        const { width, height } = canvas;
        ctx2d.setTransform(1, 0, 0, 1, 0, 0);
        ctx2d.fillStyle = '#0b1220';
        ctx2d.fillRect(0, 0, width, height);

        const x = (Math.sin(elapsed * 2) * 0.35 + 0.5) * width;
        const y = height * 0.5;
        ctx2d.fillStyle = '#409eff';
        ctx2d.beginPath();
        ctx2d.arc(x, y, Math.min(width, height) * 0.06, 0, Math.PI * 2);
        ctx2d.fill();

        ctx2d.fillStyle = '#94a3b8';
        ctx2d.font = '14px sans-serif';
        ctx2d.fillText(`frame ${frame}`, 16, 24);
      });
    },
  };
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
