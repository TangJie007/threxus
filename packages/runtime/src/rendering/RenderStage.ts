/**
 * 渲染阶段：在主 Pipeline 前后或 Overlay 中扩展绘制。
 *
 * 同阶段按 priority 升序，再按注册顺序稳定排序。
 * Stage 不得调用主 Pipeline 的 render()；修改 Renderer 状态须自行恢复或使用 state guard。
 */

import type { RenderContext } from './types';

export type RenderStagePhase =
  | 'before-main-render'
  | 'after-main-render'
  | 'overlay';

export interface RenderStage {
  readonly name: string;
  readonly stage: RenderStagePhase;
  /** 同阶段内优先级，越小越先；默认 0。 */
  readonly priority?: number;
  render(context: RenderContext): void;
}

export interface RegisteredRenderStage {
  readonly name: string;
  readonly stage: RenderStagePhase;
  readonly priority: number;
  /** 全局注册序号，保证同 priority 时稳定排序。 */
  readonly order: number;
  readonly scopeId: string;
  render(context: RenderContext): void;
}
