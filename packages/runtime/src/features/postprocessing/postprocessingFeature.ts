/**
 * Postprocessing Feature：安装唯一 Composer Pipeline + Pass 注册服务。
 */

import type { ThreeFeature } from '../../feature/ThreeFeature';
import { RenderPipelineService } from '../../rendering/RenderPipelineService';
import type { RenderPipeline } from '../../rendering/RenderPipeline';
import type { RenderContext, RenderSize } from '../../rendering/types';
import {
  PostprocessingService,
  createPassRegistry,
} from './PostprocessingService';

export interface PostprocessingFeatureOptions {
  readonly pipelineName?: string;
}

export function postprocessingFeature(
  options: PostprocessingFeatureOptions = {},
): ThreeFeature {
  return {
    name: 'postprocessing',
    provides: [PostprocessingService, RenderPipelineService],
    setup(context) {
      const registry = createPassRegistry();
      context.provide(PostprocessingService, registry);

      let lastSize: RenderSize = { width: 0, height: 0, pixelRatio: 1 };

      const pipeline: RenderPipeline = {
        name: options.pipelineName ?? 'postprocessing',
        setSize(size) {
          lastSize = size;
          for (const pass of registry.passes) {
            pass.setSize?.(size);
          }
        },
        render(renderContext: RenderContext) {
          // 主场景
          renderContext.renderer.render(
            renderContext.scene,
            renderContext.camera,
          );
          // 注册的 Pass（如 outline / FX）
          for (const pass of registry.passes) {
            pass.render(renderContext);
          }
        },
        async restore() {
          for (const pass of registry.passes) {
            await pass.restore?.();
          }
          for (const pass of registry.passes) {
            pass.setSize?.(lastSize);
          }
        },
        dispose() {
          for (const pass of [...registry.passes]) {
            registry.removePass(pass.id);
          }
        },
      };

      context.provide(RenderPipelineService, pipeline, { dispose: 'manual' });
      context.rendering.setPipeline(pipeline);
    },
  };
}
