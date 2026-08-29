import type { FrameInfo } from './FrameInfo';

/** 调度阶段。 */
export type SchedulerPhase =
  | 'fixedUpdate'
  | 'update'
  | 'beforeRender'
  | 'afterRender';

export type UpdateCallback = (frame: FrameInfo) => void;
export type FixedUpdateCallback = (step: number, frame: FrameInfo) => void;
export type RenderCallback = (frame: FrameInfo) => void;

/** 任务注册选项；priority 越小越早执行，同 priority 按注册顺序。 */
export interface TaskOptions {
  readonly priority?: number;
}

export interface SchedulerTask {
  readonly id: number;
  readonly owner: string;
  readonly phase: SchedulerPhase;
  readonly priority: number;
  readonly order: number;
  active: boolean;
  readonly run: (frame: FrameInfo, fixedStep?: number) => void;
}

let nextTaskId = 1;

export function createUpdateTask(
  owner: string,
  phase: Exclude<SchedulerPhase, 'fixedUpdate'>,
  callback: UpdateCallback | RenderCallback,
  options?: TaskOptions,
): SchedulerTask {
  const id = nextTaskId++;
  return {
    id,
    owner,
    phase,
    priority: options?.priority ?? 0,
    order: id,
    active: true,
    run: (frame) => {
      callback(frame);
    },
  };
}

export function createFixedUpdateTask(
  owner: string,
  callback: FixedUpdateCallback,
  options?: TaskOptions,
): SchedulerTask {
  const id = nextTaskId++;
  return {
    id,
    owner,
    phase: 'fixedUpdate',
    priority: options?.priority ?? 0,
    order: id,
    active: true,
    run: (frame, fixedStep) => {
      callback(fixedStep ?? 0, frame);
    },
  };
}

/** 测试辅助：重置任务 id 计数器。 */
export function resetSchedulerTaskIdsForTests(): void {
  nextTaskId = 1;
}
