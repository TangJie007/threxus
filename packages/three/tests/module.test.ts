/**
 * ThreeCoreModule / CameraService / SceneService 冒烟测试。
 */

import { describe, expect, it } from 'vitest';
import { isModule, readModuleMetadata } from '@threxus/core';
import { RuntimeModule } from '@threxus/runtime';
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import {
  AssetService,
  CameraService,
  ComponentService,
  DisposeService,
  GizmoService,
  InteractionService,
  SceneService,
  THREE_VIEWPORT,
  ThreeAssetModule,
  ThreeCoreModule,
  ThreeEditorModule,
  ThreeInteractionModule,
  ViewportService,
} from '../src/index';

describe('ThreeCoreModule', () => {
  it('只导出渲染闭环核心服务', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.imports).toContain(RuntimeModule);
    expect(meta.exports).toEqual(
      expect.arrayContaining([
        WebGLRenderer,
        SceneService,
        CameraService,
        THREE_VIEWPORT,
        ViewportService,
        DisposeService,
        ComponentService,
      ]),
    );
    expect(meta.exports).not.toContain(Scene);
    expect(meta.exports).not.toContain(PerspectiveCamera);
    expect(meta.exports).not.toContain(AssetService);
    expect(meta.exports).not.toContain(InteractionService);
    expect(meta.exports).not.toContain(GizmoService);
  });
});

describe('可选 Module', () => {
  it('ThreeAssetModule 导出 AssetService', () => {
    const meta = readModuleMetadata(ThreeAssetModule)!;
    expect(meta.exports).toEqual(
      expect.arrayContaining([AssetService]),
    );
  });

  it('ThreeInteractionModule 导出 InteractionService', () => {
    const meta = readModuleMetadata(ThreeInteractionModule)!;
    expect(meta.exports).toEqual(
      expect.arrayContaining([InteractionService]),
    );
  });

  it('ThreeEditorModule 导出 GizmoService', () => {
    const meta = readModuleMetadata(ThreeEditorModule)!;
    expect(meta.exports).toEqual(expect.arrayContaining([GizmoService]));
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
