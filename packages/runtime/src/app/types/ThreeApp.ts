/**
 * ThreeApp 公共接口。
 */

import type { Camera, Scene, WebGLRenderer } from 'three';
import type { AssetManager } from '../../assets';
import type { EntityRegistryView } from '../../entities/EntityRegistry';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import type { Disposable } from '../../lifecycle/Disposable';
import type { GraphicsState } from '../../rendering/GraphicsState';
import type { AppState } from './AppState';
import type {
  RuntimeSnapshot,
  SetCameraOptions,
} from './ThreeAppOptions';

export interface ThreeApp extends Disposable {
  readonly state: AppState;
  /** WebGL 上下文状态，与 AppState 正交。 */
  readonly graphicsState: GraphicsState;
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly renderer: WebGLRenderer;
  readonly assets: AssetManager;
  /** App 级只读实体查询；业务操作仍建议通过 Service 暴露。 */
  readonly entities: EntityRegistryView;

  use(feature: ThreeFeature): this;
  /**
   * 运行中动态安装 Feature（事务式：setup 失败则回滚该 Feature）。
   * 仅当 App 为 running / paused；依赖的服务必须已存在。
   */
  installFeature(feature: ThreeFeature): Promise<void>;
  /** 运行中卸载已安装 Feature；若仍有其它 Feature 依赖其 provides 则拒绝。 */
  uninstallFeature(name: string): Promise<void>;
  start(): Promise<void>;
  dispose(): Promise<void>;
  pause(): void;
  resume(): void;
  render(): void;
  setCamera(camera: Camera, options?: SetCameraOptions): void;
  inspect(): RuntimeSnapshot;

  /** 测试钩子：模拟 webglcontextlost。 */
  simulateContextLost(): void;
  /** 测试钩子：模拟 webglcontextrestored。 */
  simulateContextRestored(): Promise<void>;
}
