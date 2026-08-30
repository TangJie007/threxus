/**
 * 根据 ThreeAppOptions 创建 Scheduler。
 */

import { createLogger } from '../../diagnostics/Logger';
import {
  Scheduler,
  type SchedulerOptions,
} from '../../scheduler/Scheduler';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';

export function createAppScheduler(
  options: ThreeAppOptions,
  shouldRun: () => boolean,
): Scheduler {
  const logger =
    options.diagnostics?.logger?.child('scheduler') ??
    createLogger({ level: 'warn', scope: 'threxus:scheduler' });
  const schedulerOptions: SchedulerOptions = {
    shouldRun,
    onTaskError: (event) => {
      logger.error(
        `Frame task failed: owner="${event.owner}" phase="${event.phase}" frame=${event.frame}.`,
        event.error,
      );
      options.diagnostics?.onSchedulerError?.(event);
    },
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
