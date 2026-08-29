/**
 * ThreeApp 公共接口。
 */

import type { Camera, Scene, WebGLRenderer } from 'three';
import type { AssetManager } from '../../assets';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import type { Disposable } from '../../lifecycle/Disposable';
import type { AppState } from './AppState';
import type {
  RuntimeSnapshot,
  SetCameraOptions,
} from './ThreeAppOptions';

export interface ThreeApp extends Disposable {
  readonly state: AppState;
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly renderer: WebGLRenderer;
  readonly assets: AssetManager;

  use(feature: ThreeFeature): this;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  render(): void;
  setCamera(camera: Camera, options?: SetCameraOptions): void;
  inspect(): RuntimeSnapshot;
}
