/**
 * 工厂场景 Feature：模块 3 —— 材质预设 + 程序化环境接到场景。
 *
 * 当前只搭「可学习的材质展台」：地坪 / 钢结构 / 机柜 / 警示带 / 状态灯。
 * 完整厂房几何体留给后续 Factory 迁移。
 */

import {
  Inject,
  Injectable,
  type OnDispose,
  type OnModuleInit,
} from '@threxus/core';
import { SceneObjectHost } from '@threxus/three';
import {
  BoxGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import { Environment } from './environment/Environment';
import {
  buildMaterials,
  disposeMaterials,
  mat,
  type MaterialKey,
} from './materials/Presets';
import { disposeProcedural } from './materials/ProceduralTextures';

const BOUNDS = { width: 100, depth: 70, height: 11 } as const;

@Injectable()
export class FactorySceneFeature
  extends SceneObjectHost<Group>
  implements OnModuleInit, OnDispose
{
  @Inject(WebGLRenderer)
  renderer!: WebGLRenderer;

  private environment: Environment | null = null;

  onModuleInit(): void {
    buildMaterials();

    this.environment = new Environment({
      scene: this.scenes.active,
      renderer: this.renderer,
      bounds: BOUNDS,
    });

    const root = new Group();
    root.name = 'factory-materials-stage';

    const floor = new Mesh(new PlaneGeometry(BOUNDS.width, BOUNDS.depth), mat('floor'));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    // 材质对照样件：方便对照学习文档里的动手任务
    root.add(this.makeBox('steel', [-6, 2, 0], [1.2, 4, 1.2]));
    root.add(this.makeBox('machine', [0, 1.4, 0], [3.2, 2.8, 2.2]));
    root.add(this.makeBox('plastic', [5, 0.6, 1.5], [1.6, 1.2, 1.2]));
    root.add(this.makeBox('glass', [5, 1.6, 1.5], [1.4, 0.8, 0.08]));
    root.add(this.makeBox('hazard', [-2, 0.02, 6], [8, 0.04, 1.2]));

    root.add(this.makeLamp('emissiveOk', [-1.2, 3.1, 0]));
    root.add(this.makeLamp('emissiveWarn', [0, 3.1, 0]));
    root.add(this.makeLamp('emissiveErr', [1.2, 3.1, 0]));

    this.spawn(root);
  }

  onDispose(): void {
    super.onDispose();
    this.environment?.dispose();
    this.environment = null;
    disposeMaterials();
    disposeProcedural();
  }

  private makeBox(
    key: MaterialKey,
    position: [number, number, number],
    size: [number, number, number],
  ): Mesh {
    const mesh = new Mesh(new BoxGeometry(...size), mat(key));
    mesh.position.set(...position);
    mesh.castShadow = key !== 'hazard' && key !== 'glass';
    mesh.receiveShadow = true;
    mesh.name = `sample-${key}`;
    return mesh;
  }

  private makeLamp(key: MaterialKey, position: [number, number, number]): Mesh {
    const mesh = new Mesh(new SphereGeometry(0.18, 24, 16), mat(key));
    mesh.position.set(...position);
    mesh.name = `sample-${key}`;
    return mesh;
  }
}
