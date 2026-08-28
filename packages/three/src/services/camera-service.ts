/**
 * 相机服务：管理一组 PerspectiveCamera，支持切换当前渲染机位。
 *
 * 默认注册 id 为 {@link CameraService.MAIN} 的主相机。
 * 多机位时用 add / setActive；渲染与 resize 走 active。
 */

import { Injectable } from '@threxus/core';
import { PerspectiveCamera } from 'three';

@Injectable()
export class CameraService {
  /** 默认主相机 id */
  static readonly MAIN = 'main';

  private readonly cameras = new Map<string, PerspectiveCamera>();
  private activeId: string = CameraService.MAIN;

  constructor() {
    const main = new PerspectiveCamera(50, 1, 0.1, 100);
    main.position.z = 3;
    this.cameras.set(CameraService.MAIN, main);
  }

  /** 当前用于渲染的相机 */
  get active(): PerspectiveCamera {
    return this.require(this.activeId);
  }

  /** 当前激活的相机 id */
  getActiveId(): string {
    return this.activeId;
  }

  /**
   * 注册相机。
   *
   * @param id - 唯一标识
   * @param camera - Three 相机实例
   * @param active - 是否立即设为当前渲染相机
   */
  add(
    id: string,
    camera: PerspectiveCamera,
    active = false,
  ): PerspectiveCamera {
    if (this.cameras.has(id)) {
      throw new Error(`相机 "${id}" 已存在。`);
    }
    this.cameras.set(id, camera);
    if (active) {
      this.activeId = id;
    }
    return camera;
  }

  /** 按 id 取相机；不存在则 undefined */
  get(id: string): PerspectiveCamera | undefined {
    return this.cameras.get(id);
  }

  /** 是否已注册 */
  has(id: string): boolean {
    return this.cameras.has(id);
  }

  /**
   * 切换当前渲染相机。
   *
   * @param id - 已注册的相机 id
   */
  setActive(id: string): void {
    this.require(id);
    this.activeId = id;
  }

  /**
   * 移除相机。不可移除 {@link CameraService.MAIN}；若移除的是当前机位则回退到 main。
   */
  remove(id: string): boolean {
    if (id === CameraService.MAIN) {
      throw new Error(`不可移除默认主相机 "${CameraService.MAIN}"。`);
    }
    if (!this.cameras.has(id)) {
      return false;
    }
    if (this.activeId === id) {
      this.activeId = CameraService.MAIN;
    }
    return this.cameras.delete(id);
  }

  /** 已注册 id 列表 */
  list(): string[] {
    return [...this.cameras.keys()];
  }

  private require(id: string): PerspectiveCamera {
    const camera = this.cameras.get(id);
    if (!camera) {
      throw new Error(`未找到相机 "${id}"。`);
    }
    return camera;
  }
}

/**
 * @deprecated 使用 {@link CameraService}
 */
export const CameraSystem = CameraService;
