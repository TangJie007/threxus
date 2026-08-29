/**
 * ObjectHost / dispose / Viewport / EntityComponent / middleware 单测。
 */

import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
} from 'three';
import {
  CameraService,
  ComponentService,
  DisposeService,
  ObjectHost,
  RenderService,
  THREE_VIEWPORT,
  ThreeCoreModule,
  ViewportService,
  createComponentType,
  createPipeline,
  createSyncPipeline,
  disposeObject3D,
  type Component,
} from '../src/index';
import { isModule, readModuleMetadata } from '@threxus/core';

class FakeCube {
  readonly mesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial(),
  );
  dispose = vi.fn();
}

class TestHost extends ObjectHost<FakeCube> {
  attached: FakeCube[] = [];
  detached: FakeCube[] = [];

  protected attach(object: FakeCube): void {
    this.attached.push(object);
  }

  protected detach(object: FakeCube): void {
    this.detached.push(object);
  }
}

describe('ObjectHost', () => {
  it('spawn / despawn / onDispose 登记对象', () => {
    const host = new TestHost();
    const a = new FakeCube();
    const b = new FakeCube();

    host.spawn(a);
    host.spawn(b);
    expect(host.getObjects()).toEqual([a, b]);
    expect(host.attached).toEqual([a, b]);

    expect(host.despawn(a)).toBe(true);
    expect(host.getObjects()).toEqual([b]);
    expect(host.detached).toContain(a);
    expect(a.dispose).toHaveBeenCalledOnce();

    host.onDispose();
    expect(host.getObjects()).toEqual([]);
    expect(host.detached).toContain(b);
    expect(b.dispose).toHaveBeenCalledOnce();
  });
});

describe('disposeObject3D / DisposeService', () => {
  it('DisposeService 是业务回收入口', () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const parent = new Mesh();
    parent.add(mesh);
    const geoDispose = vi.spyOn(geometry, 'dispose');
    const matDispose = vi.spyOn(material, 'dispose');

    const service = new DisposeService();
    service.dispose(mesh, { recursive: false, detach: true });

    expect(mesh.parent).toBeNull();
    expect(geoDispose).toHaveBeenCalledOnce();
    expect(matDispose).toHaveBeenCalledOnce();
  });

  it('底层 disposeObject3D 仍可用于单测', () => {
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

describe('ViewportService', () => {
  it('按 THREE_VIEWPORT 配置主相机', () => {
    const cameras = new CameraService();
    const service = new ViewportService();
    service.cameras = cameras;
    service.options = {
      position: [0, 0.6, 5],
      lookAt: [0, 0, 0],
      fov: 60,
    };

    service.onModuleInit();

    const camera = cameras.active;
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0.6);
    expect(camera.position.z).toBe(5);
    expect(camera.fov).toBe(60);
  });

  it('空配置不改动 CameraService 默认位姿', () => {
    const cameras = new CameraService();
    const before = cameras.active.position.clone();
    const service = new ViewportService();
    service.cameras = cameras;
    service.options = {};

    service.onModuleInit();

    expect(cameras.active.position.equals(before)).toBe(true);
  });
});

describe('ThreeCoreModule viewport exports', () => {
  it('导出 THREE_VIEWPORT 与 ViewportService', () => {
    expect(isModule(ThreeCoreModule)).toBe(true);
    const meta = readModuleMetadata(ThreeCoreModule)!;
    expect(meta.exports).toEqual(
      expect.arrayContaining([THREE_VIEWPORT, ViewportService]),
    );
  });
});

describe('CameraService fov smoke', () => {
  it('主相机为 PerspectiveCamera', () => {
    const cameras = new CameraService();
    expect(cameras.active).toBeInstanceOf(PerspectiveCamera);
  });
});

describe('ComponentService', () => {
  it('add / update / remove 组件；无 update 不进热路径', () => {
    const ecs = new ComponentService();
    const mesh = new Mesh();
    const updates: number[] = [];
    const spin: Component = {
      type: createComponentType('spin'),
      update(dt) {
        updates.push(dt);
      },
    };
    const tag: Component = {
      type: createComponentType('tag'),
    };

    ecs.add(mesh, tag);
    ecs.add(mesh, spin);
    expect(ecs.has(mesh, spin.type)).toBe(true);
    ecs.onUpdate(0.01);
    expect(updates).toEqual([0.01]);

    expect(ecs.remove(mesh, spin.type)).toBe(true);
    ecs.onUpdate(0.02);
    expect(updates).toEqual([0.01]);
  });
});

describe('createPipeline / createSyncPipeline / RenderService.use', () => {
  it('异步中间件可短路跳过 terminal', async () => {
    const calls: string[] = [];
    const pipeline = createPipeline<{ skip?: boolean }>([
      async (ctx, next) => {
        calls.push('mw');
        if (ctx.skip) {
          return;
        }
        await next();
      },
    ]);
    await pipeline({ skip: true }, () => {
      calls.push('terminal');
    });
    expect(calls).toEqual(['mw']);

    await pipeline({ skip: false }, () => {
      calls.push('terminal');
    });
    expect(calls).toEqual(['mw', 'mw', 'terminal']);
  });

  it('同步中间件可短路且不返回 Promise', () => {
    const calls: string[] = [];
    const pipeline = createSyncPipeline<{ skip?: boolean }>([
      (ctx, next) => {
        calls.push('mw');
        if (ctx.skip) {
          return;
        }
        next();
      },
    ]);
    pipeline({ skip: true }, () => {
      calls.push('terminal');
    });
    expect(calls).toEqual(['mw']);

    pipeline({ skip: false }, () => {
      calls.push('terminal');
    });
    expect(calls).toEqual(['mw', 'mw', 'terminal']);
  });

  it('RenderService.use 注册同步中间件', () => {
    const service = new RenderService();
    service.use((_ctx, next) => next());
    expect(service).toBeInstanceOf(RenderService);
  });
});
