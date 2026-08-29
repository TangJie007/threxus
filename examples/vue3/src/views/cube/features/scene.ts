import type { ThreeFeature } from '@threxus/runtime';
import { Color } from 'three';
import { cubeSceneConfig } from '../config';

export function createSceneFeature(): ThreeFeature {
  return {
    name: 'scene',
    setup(context) {
      context.scene.background = new Color(cubeSceneConfig.background);

      // M9：overlay stage（不替换主 Pipeline，只挂扩展阶段）
      context.rendering.addStage({
        name: 'cube-overlay-marker',
        stage: 'overlay',
        priority: 0,
        render() {
          // 示例占位：真实项目可在此画 CSS2D / 调试线等
        },
      });
    },
  };
}
