/**
 * 根据 ThreeAppOptions 创建 Scheduler。
 */

import {
  Scheduler,
  type SchedulerOptions,
} from '../../scheduler/Scheduler';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';

export function createAppScheduler(
  options: ThreeAppOptions,
  shouldRun: () => boolean,
): Scheduler {
  const schedulerOptions: SchedulerOptions = {
    shouldRun,
    ...(options.renderMode !== undefined
      ? { renderMode: options.renderMode }
      : {}),
    ...(options.fixedStep !== undefined ? { fixedStep: options.fixedStep } : {}),
    ...(options.maxDelta !== undefined ? { maxDelta: options.maxDelta } : {}),
    ...(options.maxFixedStepsPerFrame !== undefined
      ? { maxFixedStepsPerFrame: options.maxFixedStepsPerFrame }
      : {}),
    ...(options.errorPolicy !== undefined
      ? { errorPolicy: options.errorPolicy }
      : {}),
    ...(options.rafDriver !== undefined
      ? { rafDriver: options.rafDriver }
      : {}),
  };

  return new Scheduler(schedulerOptions);
}
