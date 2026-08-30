/**
 * Feature 作用域渲染 API：Pipeline / Stage / 临时状态保护。
 */

import type { WebGLRenderer } from 'three';
import type { FeatureScope } from '../feature/FeatureScope';
import type { Disposable } from '../lifecycle/Disposable';
import type { RenderPipeline } from './RenderPipeline';
import type { RenderStage } from './RenderStage';
import type { RenderingRuntime } from './RenderingRuntime';

export interface ScopedRendering {
  /** 当前主 Pipeline（只读观察）。 */
  readonly pipeline: RenderPipeline;

  /**
   * 安装自定义主 Pipeline；同一时间仅允许一个所有者。
   * Feature dispose 时自动恢复 DirectRenderPipeline 并 dispose 自定义管线。
   */
  setPipeline(pipeline: RenderPipeline): void;

  /**
   * 注册渲染阶段；随 Feature 自动解绑。
   */
  addStage(stage: RenderStage): Disposable;

  /**
   * 在互斥队列中执行临时渲染，并自动恢复 Renderer 状态。
   */
  withRendererState<T>(
    task: (renderer: WebGLRenderer) => T | Promise<T>,
  ): Promise<T>;

  /** 覆盖像素比；`undefined` 恢复 App 构造选项。 */
  setPixelRatioOverride(value: number | undefined): void;
}

export function createScopedRendering(
  runtime: RenderingRuntime,
  scope: FeatureScope,
): ScopedRendering {
  const scopeId = scope.feature.name;

  return {
    get pipeline() {
      return runtime.pipeline;
    },

    setPipeline(pipeline) {
      runtime.setPipeline(pipeline, scopeId);
      scope.addCleanup(async () => {
        await runtime.restoreDefaultPipeline(scopeId);
      });
    },

    addStage(stage) {
      const disposable = runtime.addStage(stage, scopeId);
      scope.addCleanup(disposable);
      return disposable;
    },

    withRendererState(task) {
      return runtime.withRendererState(task);
    },

    setPixelRatioOverride(value) {
      runtime.setPixelRatioOverride(value);
    },
  };
}
