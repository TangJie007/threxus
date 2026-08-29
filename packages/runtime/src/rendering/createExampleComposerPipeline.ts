/**
 * 示例：模拟后处理 Composer 的自定义主 Pipeline。
 *
 * 真实项目可替换为 EffectComposer；此处仅演示 setPipeline 契约与 resize/restore。
 */

import type { RenderPipeline } from './RenderPipeline';
import type { RenderContext, RenderSize } from './types';

export interface ExampleComposerPipelineOptions {
  readonly name?: string;
  readonly onRender?: (context: RenderContext) => void;
  readonly onSetSize?: (size: RenderSize) => void;
  readonly onRestore?: () => void;
  readonly onDispose?: () => void;
}

/** 创建可记录调用的自定义 Pipeline，用于测试与示例。 */
export function createExampleComposerPipeline(
  options: ExampleComposerPipelineOptions = {},
): RenderPipeline & {
  readonly sizes: RenderSize[];
  readonly renderCount: number;
  readonly restored: boolean;
  readonly disposed: boolean;
} {
  const sizes: RenderSize[] = [];
  let renderCount = 0;
  let restored = false;
  let disposed = false;

  return {
    name: options.name ?? 'example-composer',
    get sizes() {
      return sizes;
    },
    get renderCount() {
      return renderCount;
    },
    get restored() {
      return restored;
    },
    get disposed() {
      return disposed;
    },
    setSize(size) {
      sizes.push(size);
      options.onSetSize?.(size);
    },
    render(context) {
      renderCount += 1;
      if (options.onRender) {
        options.onRender(context);
        return;
      }
      context.renderer.render(context.scene, context.camera);
    },
    restore() {
      restored = true;
      options.onRestore?.();
    },
    dispose() {
      disposed = true;
      options.onDispose?.();
    },
  };
}
