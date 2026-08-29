/**
 * RenderPipeline 服务标识。
 *
 * 声明 `provides: [RenderPipelineService]` 的 Feature 在依赖图阶段互斥；
 * 实际激活仍须调用 `ctx.rendering.setPipeline(pipeline)`，并通常
 * `ctx.provide(RenderPipelineService, pipeline)` 供其他 Feature inject。
 */

import { createServiceKey } from '../services/ServiceKey';
import type { RenderPipeline } from './RenderPipeline';

export const RenderPipelineService =
  createServiceKey<RenderPipeline>('render-pipeline');
