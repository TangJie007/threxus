/**
 * ThreeCoreModule / CameraSystem / SceneSystem 冒烟测试。
 */

import { describe, expect, it } from 'vitest';
import { isModule, readModuleMetadata } from '@threxus/core';
import { RuntimeModule } from '@threxus/runtime';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import {
  CameraSystem,
  SceneSystem,
  THREE_VIEWPORT,
  ThreeCoreModule,
  ViewportSystem,
} from '../src/index';

describe('ThreeCoreModule', () => {
  it('声明为 Module，并导出 SceneSystem / CameraSystem / Viewport 与兼容 Token', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.imports).toContain(RuntimeModule);
    expect(meta.exports).toEqual(
      expect.arrayContaining([
        WebGLRenderer,
        SceneSystem,
        Scene,
        CameraSystem,
        PerspectiveCamera,
        THREE_VIEWPORT,
        ViewportSystem,
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

describe('SceneSystem', () => {
  it('默认提供 main，并可 add / setActive / remove', () => {
    const scenes = new SceneSystem();
    expect(scenes.has(SceneSystem.MAIN)).toBe(true);
    expect(scenes.getActiveId()).toBe(SceneSystem.MAIN);
    expect(scenes.active).toBe(scenes.get(SceneSystem.MAIN));

    const extra = new Scene();
    scenes.add('overlay', extra, true);
    expect(scenes.getActiveId()).toBe('overlay');
    expect(scenes.active).toBe(extra);

    scenes.remove('overlay');
    expect(scenes.has('overlay')).toBe(false);
    expect(scenes.getActiveId()).toBe(SceneSystem.MAIN);
  });

  it('不可重复 add，不可移除 main', () => {
    const scenes = new SceneSystem();
    expect(() => scenes.add(SceneSystem.MAIN, new Scene())).toThrow(/已存在/);
    expect(() => scenes.remove(SceneSystem.MAIN)).toThrow(/不可移除/);
  });
});
