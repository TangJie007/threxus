/**
 * ThreeApp 工厂。
 */

import type { ThreeApp } from '../types/ThreeApp';
import type { ThreeAppOptions } from '../types/ThreeAppOptions';
import { ThreeAppRuntime } from './ThreeAppRuntime';

/** 创建 ThreeApp 实例。canvas 为渲染挂载点。 */
export function createThreeApp(options: ThreeAppOptions): ThreeApp {
  if (!options.canvas) {
    throw new TypeError('createThreeApp requires a canvas.');
  }

  return new ThreeAppRuntime(options);
}
