/**
 * Vue 3 薄适配：挂载时 createApplication，卸载时 dispose。
 */

import {
  onBeforeUnmount,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
} from 'vue';
import type { Constructor } from '@threxus/core';
import {
  createApplication,
  type ApplicationOptions,
  type ThrexusApplication,
} from '@threxus/runtime';

/** `useThrexus` 返回值 */
export interface UseThrexusResult {
  /** 当前应用实例（尚未创建时为 `null`） */
  app: ShallowRef<ThrexusApplication | null>;
}

/** 除 canvas 外的 Application 选项 */
export type UseThrexusOptions = Omit<ApplicationOptions, 'canvas'>;

/**
 * 在组件内绑定 Threxus 应用。
 *
 * - `canvasRef` 变化时会 dispose 旧实例并重建
 * - 组件卸载时自动 dispose
 *
 * @param rootModule - 用户根模块
 * @param canvasRef - 画布元素 ref
 * @param options - `autoStart` 等
 */
export function useThrexus(
  rootModule: Constructor,
  canvasRef: Ref<HTMLCanvasElement | null | undefined>,
  options: UseThrexusOptions = {},
): UseThrexusResult {
  const app = shallowRef<ThrexusApplication | null>(null);

  const mount = (canvas: HTMLCanvasElement | null): void => {
    app.value?.dispose();
    app.value = createApplication(rootModule, {
      ...options,
      canvas,
    });
  };

  watch(
    canvasRef,
    (el) => {
      if (!el) {
        return;
      }
      mount(el);
    },
    { immediate: true, flush: 'post' },
  );

  onBeforeUnmount(() => {
    app.value?.dispose();
    app.value = null;
  });

  return { app };
}
