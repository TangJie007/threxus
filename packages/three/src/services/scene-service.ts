/**
 * 场景服务：管理一组 THREE.Scene（**场景图** SceneGraph），支持切换当前渲染场景。
 *
 * 默认注册 id 为 {@link SceneService.MAIN} 的主场景。
 * 多场景时用 add / setActive；渲染走 active。
 * 实体增删请用 {@link SceneService.attach} / {@link SceneService.detach}。
 *
 * 注意：与 core 的 SceneScope（DI 子容器换关，`createSceneScope`）不同——
 * 本类管的是 Three 场景图对象，不是 DI 作用域。
 */

import { Injectable } from '@threxus/core';
import { Object3D, Scene } from 'three';

@Injectable()
export class SceneService {
  /** 默认主场景 id */
  static readonly MAIN = 'main';

  private readonly scenes = new Map<string, Scene>();
  private activeId: string = SceneService.MAIN;

  constructor() {
    this.scenes.set(SceneService.MAIN, new Scene());
  }

  /** 当前用于渲染的场景 */
  get active(): Scene {
    return this.require(this.activeId);
  }

  /** 当前激活的场景 id */
  getActiveId(): string {
    return this.activeId;
  }

  /**
   * 注册场景。
   *
   * @param id - 唯一标识
   * @param scene - Three 场景实例
   * @param active - 是否立即设为当前渲染场景
   */
  add(id: string, scene: Scene, active = false): Scene {
    if (this.scenes.has(id)) {
      throw new Error(`场景 "${id}" 已存在。`);
    }
    this.scenes.set(id, scene);
    if (active) {
      this.activeId = id;
    }
    return scene;
  }

  /** 按 id 取场景；不存在则 undefined */
  get(id: string): Scene | undefined {
    return this.scenes.get(id);
  }

  /** 是否已注册 */
  has(id: string): boolean {
    return this.scenes.has(id);
  }

  /**
   * 切换当前渲染场景。
   *
   * @param id - 已注册的场景 id
   */
  setActive(id: string): void {
    this.require(id);
    this.activeId = id;
  }

  /**
   * 移除场景。不可移除 {@link SceneService.MAIN}；若移除的是当前场景则回退到 main。
   */
  remove(id: string): boolean {
    if (id === SceneService.MAIN) {
      throw new Error(`不可移除默认主场景 "${SceneService.MAIN}"。`);
    }
    if (!this.scenes.has(id)) {
      return false;
    }
    if (this.activeId === id) {
      this.activeId = SceneService.MAIN;
    }
    return this.scenes.delete(id);
  }

  /** 已注册 id 列表 */
  list(): string[] {
    return [...this.scenes.keys()];
  }

  /**
   * 将 Object3D 挂到指定场景（默认当前 active）。
   */
  attach(object: Object3D, sceneId?: string): void {
    const scene = sceneId ? this.require(sceneId) : this.active;
    scene.add(object);
  }

  /**
   * 从父节点卸下 Object3D（不 dispose GPU 资源）。
   */
  detach(object: Object3D): void {
    object.parent?.remove(object);
  }

  private require(id: string): Scene {
    const scene = this.scenes.get(id);
    if (!scene) {
      throw new Error(`未找到场景 "${id}"。`);
    }
    return scene;
  }
}
