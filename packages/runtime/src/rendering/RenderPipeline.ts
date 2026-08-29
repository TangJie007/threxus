import type { RenderContext, RenderSize } from './types';

/** 主渲染管线契约；Feature 可替换实现（M5 默认 DirectRenderPipeline）。 */
export interface RenderPipeline {
  readonly name: string;
  setSize(size: RenderSize): void;
  render(context: RenderContext): void;
  dispose(): void | Promise<void>;
}
