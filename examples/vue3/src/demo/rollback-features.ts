import type { ThreeFeature } from '@threxus/runtime';
import type { DemoLogger } from './types';

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
