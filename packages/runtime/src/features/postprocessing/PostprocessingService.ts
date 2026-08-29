/**
 * 后处理 Pass 注册服务：其它 Feature 通过此服务挂 Pass，不争夺主 Pipeline。
 */

import { orderBy, remove } from 'es-toolkit';
import type { Disposable } from '../../lifecycle/Disposable';
import type { RenderContext, RenderSize } from '../../rendering/types';
import { createServiceKey } from '../../services/ServiceKey';

export interface PostPass {
  readonly id: string;
  readonly priority?: number;
  render(context: RenderContext): void;
  setSize?(size: RenderSize): void;
  restore?(): void | Promise<void>;
  dispose?(): void;
}

export interface PostprocessingService {
  readonly passes: readonly PostPass[];
  addPass(pass: PostPass): Disposable;
}

export const PostprocessingService =
  createServiceKey<PostprocessingService>('postprocessing');

export function sortPasses(passes: readonly PostPass[]): PostPass[] {
  return orderBy(
    [...passes],
    [(pass) => pass.priority ?? 0, (pass) => pass.id],
    ['asc', 'asc'],
  );
}

export function createPassRegistry(): PostprocessingService & {
  removePass(id: string): void;
} {
  const passes: PostPass[] = [];

  return {
    get passes() {
      return sortPasses(passes);
    },
    addPass(pass): Disposable {
      if (passes.some((item) => item.id === pass.id)) {
        throw new Error(`PostPass id "${pass.id}" is already registered.`);
      }
      passes.push(pass);
      return {
        dispose: () => {
          remove(passes, (item) => item.id === pass.id);
          pass.dispose?.();
        },
      };
    },
    removePass(id: string) {
      const found = passes.find((item) => item.id === id);
      remove(passes, (item) => item.id === id);
      found?.dispose?.();
    },
  };
}
