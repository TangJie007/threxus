/**
 * Asset / Serialize / Command / InstancedFoliage 冒烟测试。
 */

import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import {
  AssetService,
  CommandService,
  ConfigService,
  InstancedFoliageService,
  SceneService,
  SelectionService,
  SerializeService,
  DisposeService,
} from '../src/index';

describe('AssetService', () => {
  it('同 key 二次 load 命中缓存', async () => {
    const assets = new AssetService();
    const loader = vi.fn(async () => ({ ok: true }));
    const a = await assets.load('mesh', '/a.json', loader);
    const b = await assets.load('mesh', '/a.json', loader);
    expect(a).toBe(b);
    expect(loader).toHaveBeenCalledOnce();
    expect(assets.has('mesh')).toBe(true);
  });
});

describe('SerializeService', () => {
  it('serialize → deserialize 往返', async () => {
    const scenes = new SceneService();
    const child = new Object3D();
    child.name = 'box';
    child.position.set(1, 2, 3);
    scenes.attach(child);

    const service = new SerializeService();
    service.scenes = scenes;
    const doc = await service.serialize();
    expect(doc.version).toBe(1);
    expect(doc.nodes[0]?.position).toEqual([1, 2, 3]);

    const again = await service.deserialize(doc);
    expect(again.nodes).toHaveLength(1);
  });

  it('非法 JSON 抛错', async () => {
    const service = new SerializeService();
    service.scenes = new SceneService();
    await expect(service.deserialize({ version: 2 })).rejects.toThrow();
  });
});

describe('CommandService', () => {
  it('execute / undo / redo', async () => {
    let value = 0;
    const commands = new CommandService();
    await commands.execute({
      execute: () => {
        value += 1;
      },
      undo: () => {
        value -= 1;
      },
    });
    expect(value).toBe(1);
    await commands.undo();
    expect(value).toBe(0);
    await commands.redo();
    expect(value).toBe(1);
  });
});

describe('ConfigService', () => {
  it('合并并校验配置', () => {
    const config = new ConfigService();
    config.set({ debug: true, assetConcurrency: 2 });
    expect(config.get().debug).toBe(true);
    expect(config.get().assetConcurrency).toBe(2);
  });
});

describe('SelectionService', () => {
  it('set / clear', () => {
    const selection = new SelectionService();
    const obj = new Object3D();
    selection.set([obj]);
    expect(selection.primary).toBe(obj);
    selection.clear();
    expect(selection.getAll()).toEqual([]);
  });
});

describe('InstancedFoliageService', () => {
  it('create 注册 InstancedMesh 到场景', () => {
    const scenes = new SceneService();
    const disposeService = new DisposeService();
    const foliage = new InstancedFoliageService();
    foliage.scenes = scenes;
    foliage.disposeService = disposeService;

    const mesh = foliage.create(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), [
      { position: [0, 0, 0] },
      { position: [1, 0, 0], scale: 2, color: [1, 0, 0] },
    ]);
    expect(foliage.getMesh()).toBe(mesh);
    expect(scenes.active.children).toContain(mesh);
    expect(mesh.count).toBe(2);

    foliage.onDispose();
    expect(foliage.getMesh()).toBeNull();
  });
});
