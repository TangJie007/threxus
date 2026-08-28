/**
 * ThreeCoreModule / CameraSystem 冒烟测试。
 */

import { describe, expect, it } from 'vitest';
import { isModule, readModuleMetadata } from '@threxus/core';
import { RuntimeModule } from '@threxus/runtime';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { CameraSystem, ThreeCoreModule } from '../src/index';

describe('ThreeCoreModule', () => {
  it('声明为 Module，并 imports RuntimeModule、导出 three Token 与 CameraSystem', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.imports).toContain(RuntimeModule);
    expect(meta.exports).toEqual(
      expect.arrayContaining([
        WebGLRenderer,
        Scene,
        CameraSystem,
        PerspectiveCamera,
      ]),
    );
  });
});

describe('CameraSystem', () => {
  it('默认提供 main，并可 add / setActive / remove', () => {
    const cameras = new CameraSystem();
    expect(cameras.has(CameraSystem.MAIN)).toBe(true);
    expect(cameras.getActiveId()).toBe(CameraSystem.MAIN);
    expect(cameras.active).toBe(cameras.get(CameraSystem.MAIN));

    const extra = new PerspectiveCamera(40, 1, 0.1, 50);
    cameras.add('side', extra, true);
    expect(cameras.getActiveId()).toBe('side');
    expect(cameras.active).toBe(extra);

    cameras.remove('side');
    expect(cameras.has('side')).toBe(false);
    expect(cameras.getActiveId()).toBe(CameraSystem.MAIN);
  });

  it('不可重复 add，不可移除 main', () => {
    const cameras = new CameraSystem();
    expect(() =>
      cameras.add(CameraSystem.MAIN, new PerspectiveCamera()),
    ).toThrow(/已存在/);
    expect(() => cameras.remove(CameraSystem.MAIN)).toThrow(/不可移除/);
  });
});
