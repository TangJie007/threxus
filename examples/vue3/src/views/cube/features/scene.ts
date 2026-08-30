import type { ThreeFeature } from '@threxus/runtime';

/**
 * M9 overlay stage（环境光与背景改由 environmentFeature 负责）。
 */
export function createSceneFeature(): ThreeFeature {
  return {
    name: 'scene',
    setup(context) {
      context.rendering.addStage({
        name: 'cube-overlay-marker',
        stage: 'overlay',
        priority: 0,
        render() {
          // 示例占位：真实项目可在此画 CSS2D / 调试线等
        },
      });

      context.onContextLost(() => {
        // 由页面 log 桥接；此处保证 API 可用
      });
    },
  };
}
