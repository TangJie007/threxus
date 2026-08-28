/**
 * ThreeCoreModule / CameraService / SceneService 冒烟测试。
 */

import { describe, expect, it } from 'vitest';
import { isModule, readModuleMetadata } from '@threxus/core';
import { RuntimeModule } from '@threxus/runtime';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import {
  CameraService,
  DisposeService,
  EntityComponentService,
  SceneService,
  THREE_VIEWPORT,
  ThreeCoreModule,
  ViewportService,
} from '../src/index';

describe('ThreeCoreModule', () => {
  it('声明为 Module，并导出 SceneService / CameraService / Viewport 与兼容 Token', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.imports).toContain(RuntimeModule);
    expect(meta.exports).toEqual(
      expect.arrayContaining([
        WebGLRenderer,
        SceneService,
        Scene,
        CameraService,
        PerspectiveCamera,
        THREE_VIEWPORT,
        ViewportService,
        DisposeService,
        EntityComponentService,
      ]),
    );
  });
});

describe('CameraService', () => {
  it('默认提供 main，并可 add / setActive / remove', () => {
    const cameras = new CameraService();
    expect(cameras.has(CameraService.MAIN)).toBe(true);
    expect(cameras.getActiveId()).toBe(CameraService.MAIN);
    expect(cameras.active).toBe(cameras.get(CameraService.MAIN));

    const extra = new PerspectiveCamera(40, 1, 0.1, 50);
    cameras.add('side', extra, true);
    expect(cameras.getActiveId()).toBe('side');
    expect(cameras.active).toBe(extra);

    cameras.remove('side');
    expect(cameras.has('side')).toBe(false);
    expect(cameras.getActiveId()).toBe(CameraService.MAIN);
  });

  it('不可重复 add，不可移除 main', () => {
    const cameras = new CameraService();
    expect(() =>
      cameras.add(CameraService.MAIN, new PerspectiveCamera()),
    ).toThrow(/已存在/);
    expect(() => cameras.remove(CameraService.MAIN)).toThrow(/不可移除/);
  });
});

describe('SceneService', () => {
  it('默认提供 main，并可 add / setActive / remove', () => {
    const scenes = new SceneService();
    expect(scenes.has(SceneService.MAIN)).toBe(true);
    expect(scenes.getActiveId()).toBe(SceneService.MAIN);
    expect(scenes.active).toBe(scenes.get(SceneService.MAIN));

    const extra = new Scene();
    scenes.add('overlay', extra, true);
    expect(scenes.getActiveId()).toBe('overlay');
    expect(scenes.active).toBe(extra);

    scenes.remove('overlay');
    expect(scenes.has('overlay')).toBe(false);
    expect(scenes.getActiveId()).toBe(SceneService.MAIN);
  });

  it('不可重复 add，不可移除 main', () => {
    const scenes = new SceneService();
    expect(() => scenes.add(SceneService.MAIN, new Scene())).toThrow(/已存在/);
    expect(() => scenes.remove(SceneService.MAIN)).toThrow(/不可移除/);
  });

  it('attach / detach 托管 Object3D', () => {
    const scenes = new SceneService();
    const obj = new Scene();
    scenes.attach(obj);
    expect(scenes.active.children).toContain(obj);
    scenes.detach(obj);
    expect(scenes.active.children).not.toContain(obj);
  });
});
