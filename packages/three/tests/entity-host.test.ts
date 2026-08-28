/**
 * EntityHost / disposeObject3D / ViewportSystem 单测。
 */

import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
} from 'three';
import {
  CameraSystem,
  disposeObject3D,
  EntityHost,
  THREE_VIEWPORT,
  ThreeCoreModule,
  ViewportSystem,
} from '../src/index';
import { isModule, readModuleMetadata } from '@threxus/core';

class FakeCube {
  readonly mesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial(),
  );
  update = vi.fn();
  dispose = vi.fn();
}

class TestHost extends EntityHost<FakeCube> {
  attached: FakeCube[] = [];
  detached: FakeCube[] = [];

  protected attach(entity: FakeCube): void {
    this.attached.push(entity);
  }

  protected detach(entity: FakeCube): void {
    this.detached.push(entity);
  }
}

describe('EntityHost', () => {
  it('spawn / onUpdate / despawn / onDispose 驱动实体', () => {
    const host = new TestHost();
    const a = new FakeCube();
    const b = new FakeCube();

    host.spawn(a);
    host.spawn(b);
    expect(host.getEntities()).toEqual([a, b]);
    expect(host.attached).toEqual([a, b]);

    host.onUpdate(0.016);
    expect(a.update).toHaveBeenCalledWith(0.016);
    expect(b.update).toHaveBeenCalledWith(0.016);

    expect(host.despawn(a)).toBe(true);
    expect(host.getEntities()).toEqual([b]);
    expect(host.detached).toContain(a);
    expect(a.dispose).toHaveBeenCalledOnce();

    host.onDispose();
    expect(host.getEntities()).toEqual([]);
    expect(host.detached).toContain(b);
    expect(b.dispose).toHaveBeenCalledOnce();
  });
});

describe('disposeObject3D', () => {
  it('释放 Mesh 的 geometry 与 material', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const geoDispose = vi.spyOn(geometry, 'dispose');
    const matDispose = vi.spyOn(material, 'dispose');

    disposeObject3D(mesh, false);

    expect(geoDispose).toHaveBeenCalledOnce();
    expect(matDispose).toHaveBeenCalledOnce();
  });
});

describe('ViewportSystem', () => {
  it('按 THREE_VIEWPORT 配置主相机', () => {
    const cameras = new CameraSystem();
    const system = new ViewportSystem();
    system.cameras = cameras;
    system.options = {
      position: [0, 0.6, 5],
      lookAt: [0, 0, 0],
      fov: 60,
    };

    system.onModuleInit();

    const camera = cameras.active;
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0.6);
    expect(camera.position.z).toBe(5);
    expect(camera.fov).toBe(60);
  });

  it('空配置不改动 CameraSystem 默认位姿', () => {
    const cameras = new CameraSystem();
    const before = cameras.active.position.clone();
    const system = new ViewportSystem();
    system.cameras = cameras;
    system.options = {};

    system.onModuleInit();

    expect(cameras.active.position.equals(before)).toBe(true);
  });
});

describe('ThreeCoreModule viewport exports', () => {
  it('导出 THREE_VIEWPORT 与 ViewportSystem', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.exports).toEqual(
      expect.arrayContaining([THREE_VIEWPORT, ViewportSystem]),
    );
  });
});

describe('CameraSystem fov smoke', () => {
  it('主相机为 PerspectiveCamera', () => {
    const cameras = new CameraSystem();
    expect(cameras.active).toBeInstanceOf(PerspectiveCamera);
  });
});
