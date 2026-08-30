/**
 * 帧调度器：RAF 驱动、分阶段回调、固定时间步与按需渲染。
 *
 * 帧流水线：
 * ```text
 * fixed-update → update → before-render → render → after-render
 * ```
 * M4 不含 WebGL render；before/after 钩子供 M5 管线挂接。
 *
 * RAF 规则：
 * - 同一 App 最多一个待执行 RAF。
 * - continuous：running 时每帧结束后调度下一帧。
 * - on-demand：仅 invalidate 后调度；同 tick 多次 invalidate 合并。
 * - pause / dispose 必须取消待执行 RAF。
 */

import { orderBy } from 'es-toolkit';
import { ThrexusError, toError } from '../errors';
import type { Disposable } from '../lifecycle/Disposable';
import { FixedStepAccumulator } from './FixedStepAccumulator';
import type { FrameInfo } from './FrameInfo';
import {
  createBrowserRafDriver,
  type RafDriver,
} from './RafDriver';
import {
  createFixedUpdateTask,
  createUpdateTask,
  type FixedUpdateCallback,
  type RenderCallback,
  type SchedulerPhase,
  type SchedulerTask,
  type TaskOptions,
  type UpdateCallback,
} from './SchedulerTask';

export type RenderMode = 'continuous' | 'on-demand';
export type SchedulerErrorPolicy = 'throw' | 'stop' | 'continue';

export interface SchedulerTaskError {
  readonly error: Error;
  readonly owner: string;
  readonly phase: SchedulerPhase;
  readonly frame: number;
}

export interface SchedulerErrorSnapshot {
  readonly message: string;
  readonly owner: string;
  readonly phase: SchedulerPhase;
  readonly frame: number;
}

export interface SchedulerOptions {
  readonly renderMode?: RenderMode;
  readonly fixedStep?: number;
  readonly maxDelta?: number;
  readonly maxFixedStepsPerFrame?: number;
  readonly errorPolicy?: SchedulerErrorPolicy;
  readonly rafDriver?: RafDriver;
  /** 返回 false 时不调度下一帧（App 非 running / paused）。 */
  readonly shouldRun?: () => boolean;
  /** M5：在 beforeRender 与 afterRender 之间执行主渲染。 */
  readonly renderHook?: () => void;
  /** 帧任务异常观察器；无论 errorPolicy 为何都会调用。 */
  readonly onTaskError?: (event: SchedulerTaskError) => void;
}

export interface SchedulerSnapshot {
  readonly renderMode: RenderMode;
  readonly running: boolean;
  readonly paused: boolean;
  readonly frame: number;
  readonly pendingRaf: boolean;
  readonly invalidated: boolean;
  readonly lastTaskError: SchedulerErrorSnapshot | null;
  readonly tasks: Readonly<Record<SchedulerPhase, number>>;
}

interface PhaseRegistry {
  active: SchedulerTask[];
  pending: SchedulerTask[];
}

export class Scheduler implements Disposable {
  readonly #renderMode: RenderMode;
  readonly #maxDelta: number;
  readonly #errorPolicy: SchedulerErrorPolicy;
  readonly #raf: RafDriver;
  readonly #shouldRun: () => boolean;
  readonly #onTaskError: (event: SchedulerTaskError) => void;
  #renderHook: (() => void) | undefined;
  readonly #fixedAccumulator: FixedStepAccumulator | undefined;
  readonly #phases: Record<SchedulerPhase, PhaseRegistry> = {
    fixedUpdate: { active: [], pending: [] },
    update: { active: [], pending: [] },
    beforeRender: { active: [], pending: [] },
    afterRender: { active: [], pending: [] },
  };

  #running = false;
  #paused = false;
  #disposed = false;
  #executing = false;
  #stopFrame = false;
  #invalidated = false;
  #rafId: number | undefined;
  #lastTime: number | null = null;
  #elapsed = 0;
  #frame = 0;
  #lastTaskError: SchedulerErrorSnapshot | null = null;
  #started = false;

  constructor(options: SchedulerOptions = {}) {
    this.#renderMode = options.renderMode ?? 'continuous';
    this.#maxDelta = options.maxDelta ?? 0.1;
    this.#errorPolicy = options.errorPolicy ?? 'continue';
    this.#raf = options.rafDriver ?? createBrowserRafDriver();
    this.#shouldRun = options.shouldRun ?? (() => true);
    this.#onTaskError =
      options.onTaskError ??
      ((event) => {
        console.error(
          `[threxus:scheduler] Frame task failed: owner="${event.owner}" phase="${event.phase}" frame=${event.frame}.`,
          event.error,
        );
      });
    this.#renderHook = options.renderHook;

    if (options.fixedStep !== undefined && options.fixedStep > 0) {
      this.#fixedAccumulator = new FixedStepAccumulator(
        options.fixedStep,
        options.maxFixedStepsPerFrame ?? 5,
      );
    }
  }

  get renderMode(): RenderMode {
    return this.#renderMode;
  }

  /** 启动后设置主渲染钩子（RenderingRuntime 初始化之后调用）。 */
  setRenderHook(hook: () => void): void {
    this.#renderHook = hook;
  }

  start(): void {
    this.#assertNotDisposed();
    if (this.#started) {
      return;
    }
    this.#started = true;
    this.#running = true;
    this.#paused = false;
    this.#lastTime = null;
    this.#scheduleIfNeeded();
  }

  pause(): void {
    this.#assertNotDisposed();
    if (this.#paused) {
      return;
    }
    this.#paused = true;
    this.#cancelRaf();
  }

  resume(): void {
    this.#assertNotDisposed();
    if (!this.#paused) {
      return;
    }
    this.#paused = false;
    this.#lastTime = null;
    this.#scheduleIfNeeded();
  }

  stop(): void {
    this.#running = false;
    this.#cancelRaf();
    this.#invalidated = false;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.stop();
    this.#disposed = true;
    for (const phase of Object.keys(this.#phases) as SchedulerPhase[]) {
      this.#phases[phase].active = [];
      this.#phases[phase].pending = [];
    }
  }

  invalidate(): void {
    this.#assertNotDisposed();
    if (!this.#running || this.#paused || this.#renderMode !== 'on-demand') {
      return;
    }
    this.#invalidated = true;
    this.#scheduleIfNeeded();
  }

  onUpdate(
    owner: string,
    callback: UpdateCallback,
    options?: TaskOptions,
  ): Disposable {
    return this.#register(owner, 'update', callback, options);
  }

  onFixedUpdate(
    owner: string,
    callback: FixedUpdateCallback,
    options?: TaskOptions,
  ): Disposable {
    this.#assertFixedStepEnabled();
    const task = createFixedUpdateTask(owner, callback, options);
    return this.#addTask('fixedUpdate', task);
  }

  onBeforeRender(
    owner: string,
    callback: RenderCallback,
    options?: TaskOptions,
  ): Disposable {
    return this.#register(owner, 'beforeRender', callback, options);
  }

  onAfterRender(
    owner: string,
    callback: RenderCallback,
    options?: TaskOptions,
  ): Disposable {
    return this.#register(owner, 'afterRender', callback, options);
  }

  /** 测试专用：手动推进一帧（需配合 ManualRafDriver 或直接调用）。 */
  tick(time: number): void {
    this.#onFrame(time);
  }

  inspect(): SchedulerSnapshot {
    return {
      renderMode: this.#renderMode,
      running: this.#running,
      paused: this.#paused,
      frame: this.#frame,
      pendingRaf: this.#rafId !== undefined,
      invalidated: this.#invalidated,
      lastTaskError: this.#lastTaskError,
      tasks: {
        fixedUpdate: this.#countActive('fixedUpdate'),
        update: this.#countActive('update'),
        beforeRender: this.#countActive('beforeRender'),
        afterRender: this.#countActive('afterRender'),
      },
    };
  }

  #register(
    owner: string,
    phase: Exclude<SchedulerPhase, 'fixedUpdate'>,
    callback: UpdateCallback | RenderCallback,
    options?: TaskOptions,
  ): Disposable {
    const task = createUpdateTask(owner, phase, callback, options);
    return this.#addTask(phase, task);
  }

  #addTask(phase: SchedulerPhase, task: SchedulerTask): Disposable {
    this.#assertNotDisposed();
    const registry = this.#phases[phase];
    if (this.#executing) {
      registry.pending.push(task);
    } else {
      registry.active.push(task);
    }

    return {
      dispose: () => {
        task.active = false;
      },
    };
  }

  #scheduleIfNeeded(): void {
    if (
      !this.#running ||
      this.#paused ||
      this.#disposed ||
      this.#rafId !== undefined ||
      !this.#shouldRun()
    ) {
      return;
    }

    if (this.#renderMode === 'on-demand' && !this.#invalidated) {
      return;
    }

    this.#rafId = this.#raf.request((time) => {
      this.#rafId = undefined;
      this.#onFrame(time);
    });
  }

  #cancelRaf(): void {
    if (this.#rafId !== undefined) {
      this.#raf.cancel(this.#rafId);
      this.#rafId = undefined;
    }
  }

  #onFrame(time: number): void {
    if (!this.#running || this.#paused || this.#disposed || !this.#shouldRun()) {
      return;
    }

    const rawDelta =
      this.#lastTime === null
        ? 0
        : Math.max(0, (time - this.#lastTime) / 1000);
    this.#lastTime = time;

    const delta = Math.min(rawDelta, this.#maxDelta);
    this.#frame += 1;
    this.#elapsed += delta;

    const frame: FrameInfo = {
      delta,
      elapsed: this.#elapsed,
      frame: this.#frame,
      time,
    };

    this.#executing = true;
    this.#stopFrame = false;
    this.#invalidated = false;

    try {
      if (this.#fixedAccumulator) {
        for (const step of this.#fixedAccumulator.consume(delta)) {
          if (this.#stopFrame) {
            break;
          }
          this.#runPhase('fixedUpdate', frame, step);
        }
      }

      if (!this.#stopFrame) {
        this.#runPhase('update', frame);
      }
      if (!this.#stopFrame) {
        this.#runPhase('beforeRender', frame);
      }
      if (!this.#stopFrame) {
        this.#renderHook?.();
      }
      if (!this.#stopFrame) {
        this.#runPhase('afterRender', frame);
      }
    } finally {
      this.#executing = false;
      this.#mergePending();
      this.#compactInactive();
    }

    this.#scheduleIfNeeded();
  }

  #runPhase(
    phase: SchedulerPhase,
    frame: FrameInfo,
    fixedStep?: number,
  ): void {
    const tasks = this.#sortedActive(phase);
    for (const task of tasks) {
      if (!task.active || this.#stopFrame) {
        continue;
      }

      try {
        task.run(frame, fixedStep);
      } catch (error) {
        this.#handleTaskError(error, task, phase);
      }
    }
  }

  #handleTaskError(
    error: unknown,
    task: SchedulerTask,
    phase: SchedulerPhase,
  ): void {
    const normalized = toError(error);
    const event: SchedulerTaskError = {
      error: normalized,
      owner: task.owner,
      phase,
      frame: this.#frame,
    };
    this.#lastTaskError = {
      message: normalized.message,
      owner: task.owner,
      phase,
      frame: this.#frame,
    };
    try {
      this.#onTaskError(event);
    } catch {
      // 诊断观察器不能破坏帧循环的异常策略。
    }
    if (this.#errorPolicy === 'throw') {
      throw normalized;
    }
    if (this.#errorPolicy === 'stop') {
      this.#stopFrame = true;
      return;
    }
  }

  #sortedActive(phase: SchedulerPhase): readonly SchedulerTask[] {
    return orderBy(
      this.#phases[phase].active.filter((task) => task.active),
      [(task) => task.priority, (task) => task.order],
      ['asc', 'asc'],
    );
  }

  #mergePending(): void {
    for (const phase of Object.keys(this.#phases) as SchedulerPhase[]) {
      const registry = this.#phases[phase];
      if (registry.pending.length === 0) {
        continue;
      }
      registry.active.push(...registry.pending);
      registry.pending = [];
    }
  }

  #compactInactive(): void {
    for (const phase of Object.keys(this.#phases) as SchedulerPhase[]) {
      const registry = this.#phases[phase];
      registry.active = registry.active.filter((task) => task.active);
    }
  }

  #countActive(phase: SchedulerPhase): number {
    return this.#phases[phase].active.filter((task) => task.active).length;
  }

  #assertFixedStepEnabled(): void {
    if (!this.#fixedAccumulator) {
      throw new ThrexusError(
        'APP_STATE',
        'onFixedUpdate requires fixedStep to be configured on the app.',
      );
    }
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new ThrexusError(
        'APP_STATE',
        'Scheduler is disposed.',
      );
    }
  }
}
