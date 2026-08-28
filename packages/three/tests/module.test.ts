/**
 * 包级导出冒烟（真实 WebGL 由 Vue 示例覆盖）。
 */

import { describe, expect, it } from 'vitest';
import { isModule, readModuleMetadata } from '@threxus/core';
import { RuntimeModule } from '@threxus/runtime';
import {
  CAMERA,
  SCENE,
  ThreeCoreModule,
  WEBGL_RENDERER,
} from '../src/index';

describe('ThreeCoreModule', () => {
  it('声明为 Module，并 imports RuntimeModule、导出核心 Token', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.imports).toContain(RuntimeModule);
    expect(meta.exports).toEqual(
      expect.arrayContaining([WEBGL_RENDERER, SCENE, CAMERA]),
    );
  });
});
