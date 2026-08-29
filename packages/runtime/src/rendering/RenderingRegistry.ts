/**
 * 渲染扩展注册表：自定义 Pipeline 所有者 + RenderStage 列表。
 */

import { orderBy, remove } from 'es-toolkit';
import { ThrexusError } from '../errors';
import type { RenderPipeline } from './RenderPipeline';
import type {
  RegisteredRenderStage,
  RenderStage,
  RenderStagePhase,
} from './RenderStage';

export interface RenderingRegistrySnapshot {
  readonly pipelineName: string;
  readonly pipelineOwner: string | null;
  readonly stages: number;
}

export class RenderingRegistry {
  readonly #defaultPipeline: RenderPipeline;
  #activePipeline: RenderPipeline;
  #pipelineOwner: string | null = null;
  readonly #stages: RegisteredRenderStage[] = [];
  #nextOrder = 0;
  #sortedDirty = true;
  #sortedCache: RegisteredRenderStage[] = [];

  constructor(defaultPipeline: RenderPipeline) {
    this.#defaultPipeline = defaultPipeline;
    this.#activePipeline = defaultPipeline;
  }

  get pipeline(): RenderPipeline {
    return this.#activePipeline;
  }

  get pipelineOwner(): string | null {
    return this.#pipelineOwner;
  }

  get isCustomPipeline(): boolean {
    return this.#activePipeline !== this.#defaultPipeline;
  }

  setPipeline(pipeline: RenderPipeline, owner: string): void {
    if (this.#pipelineOwner !== null) {
      throw new ThrexusError(
        'PIPELINE_STATE',
        `RenderPipeline is already owned by feature "${this.#pipelineOwner}"; feature "${owner}" cannot replace it silently.`,
      );
    }

    this.#activePipeline = pipeline;
    this.#pipelineOwner = owner;
  }

  /**
   * 恢复默认 Pipeline。仅允许当前所有者调用。
   * @returns 被卸下的自定义 Pipeline（若有）
   */
  restoreDefaultPipeline(owner: string): RenderPipeline | null {
    if (this.#pipelineOwner === null) {
      return null;
    }
    if (this.#pipelineOwner !== owner) {
      throw new ThrexusError(
        'PIPELINE_STATE',
        `Feature "${owner}" cannot restore pipeline owned by "${this.#pipelineOwner}".`,
      );
    }

    const previous = this.#activePipeline;
    this.#activePipeline = this.#defaultPipeline;
    this.#pipelineOwner = null;
    return previous === this.#defaultPipeline ? null : previous;
  }

  addStage(stage: RenderStage, scopeId: string): RegisteredRenderStage {
    const registered: RegisteredRenderStage = {
      name: stage.name,
      stage: stage.stage,
      priority: stage.priority ?? 0,
      order: this.#nextOrder,
      scopeId,
      render: stage.render.bind(stage),
    };
    this.#nextOrder += 1;
    this.#stages.push(registered);
    this.#sortedDirty = true;
    return registered;
  }

  removeStage(registered: RegisteredRenderStage): boolean {
    const before = this.#stages.length;
    remove(
      this.#stages,
      (item) =>
        item.order === registered.order && item.scopeId === registered.scopeId,
    );
    if (this.#stages.length !== before) {
      this.#sortedDirty = true;
      return true;
    }
    return false;
  }

  removeStagesByScope(scopeId: string): number {
    const before = this.#stages.length;
    remove(this.#stages, (item) => item.scopeId === scopeId);
    const removed = before - this.#stages.length;
    if (removed > 0) {
      this.#sortedDirty = true;
    }
    return removed;
  }

  stagesFor(phase: RenderStagePhase): readonly RegisteredRenderStage[] {
    return this.#sorted().filter((item) => item.stage === phase);
  }

  inspect(): RenderingRegistrySnapshot {
    return {
      pipelineName: this.#activePipeline.name,
      pipelineOwner: this.#pipelineOwner,
      stages: this.#stages.length,
    };
  }

  clear(): void {
    this.#stages.length = 0;
    this.#sortedDirty = true;
    this.#sortedCache = [];
    this.#activePipeline = this.#defaultPipeline;
    this.#pipelineOwner = null;
  }

  #sorted(): readonly RegisteredRenderStage[] {
    if (!this.#sortedDirty) {
      return this.#sortedCache;
    }
    this.#sortedCache = orderBy(this.#stages, ['priority', 'order'], [
      'asc',
      'asc',
    ]);
    this.#sortedDirty = false;
    return this.#sortedCache;
  }
}
