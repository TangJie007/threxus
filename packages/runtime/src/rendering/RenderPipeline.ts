/**
 * 主渲染管线契约。
 *
 * App 始终恰好有一个主 Pipeline；未安装自定义实现时使用 DirectRenderPipeline。
 * 自定义 Pipeline 通过 `ctx.rendering.setPipeline` 安装，禁止静默覆盖。
 */

import type { RenderContext, RenderSize } from './types';

export interface RenderPipeline {
  readonly name: string;
  setSize(size: RenderSize): void;
  render(context: RenderContext): void;
  /** Context 恢复等场景的可选钩子（M10 会调用）。 */
  restore?(): void | Promise<void>;
  dispose(): void | Promise<void>;
}
