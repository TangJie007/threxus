/**
 * 渲染运行时：Scene / Camera / Renderer、Resize、Pipeline 与相机切换。
 *
 * 在 App start 时初始化，Feature setup 期间通过 ThreeContext 访问。
 * App dispose 时按所有权释放 app 自有 Renderer。
 */

import type { Camera, Object3D, Scene, WebGLRenderer } from 'three';
import { ThrexusError } from '../errors';
import type { Disposable } from '../lifecycle/Disposable';
import type { FeatureScope } from '../feature/FeatureScope';
import { resolveCamera } from './CameraFactory';
import { CoreObjectOwnership } from './CoreObjectOwnership';
import { DirectRenderPipeline } from './DirectRenderPipeline';
import { OwnedObjectRegistry } from './OwnedObjectRegistry';
import { resolvePixelRatio } from './PixelRatioController';
import type { RenderPipeline } from './RenderPipeline';
import { resolveRenderer, resolveScene } from './RendererFactory';
import { ResizeController } from './ResizeController';
import type {
  CameraChangedEvent,
  Ownership,
  RenderSize,
  RenderingInitOptions,
} from './types';
import {
  isOrthographicCamera,
  isOrthographicCameraOptions,
  isPerspectiveCamera,
} from './types';

export interface RenderingSnapshot {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly canRender: boolean;
  readonly sceneOwnership: Ownership;
  readonly rendererOwnership: Ownership;
  readonly cameraOwnership: Ownership;
}

export class RenderingRuntime implements Disposable {
  readonly scene: Scene;
  readonly renderer: WebGLRenderer;
  readonly #canvas: HTMLCanvasElement;
  readonly #ownership = new CoreObjectOwnership();
  readonly #ownedObjects = new OwnedObjectRegistry();
  readonly #pipeline: RenderPipeline;
  readonly #resizeController: ResizeController | undefined;
  readonly #pixelRatioOption: RenderingInitOptions['pixelRatio'];
  readonly #cameraChangedListeners = new Set<
    (event: CameraChangedEvent) => void
  >();

  #camera: Camera;
  #disposed = false;

  constructor(options: RenderingInitOptions) {
    this.#canvas = options.canvas;
    const sceneResolved = resolveScene(options.scene);
    this.scene = this.#ownership.register(
      sceneResolved.value,
      sceneResolved.ownership,
    );

    const rendererResolved = resolveRenderer(
      options.canvas,
      options.renderer,
    );
    this.renderer = this.#ownership.register(
      rendererResolved.value,
      rendererResolved.ownership,
    );

    const initialAspect = this.#readAspect(options.canvas);
    const cameraResolved = resolveCamera(options.camera, initialAspect);
    this.#camera = this.#ownership.register(
      cameraResolved.value,
      cameraResolved.ownership,
    );

    if (isOrthographicCameraOptions(options.camera)) {
      this.#orthoFrustumSize = options.camera.frustumSize ?? 10;
    }

    this.#pixelRatioOption = options.pixelRatio;
    this.#pipeline = new DirectRenderPipeline();

    const resizeEnabled = this.#isResizeEnabled(options.resize);
    if (resizeEnabled) {
      this.#resizeController = new ResizeController({
        canvas: options.canvas,
        renderer: this.renderer,
        getCamera: () => this.#camera,
        getPixelRatio: () => resolvePixelRatio(this.#pixelRatioOption),
        onResize: (size) => {
          this.#pipeline.setSize(size);
        },
      });
      if (isOrthographicCameraOptions(options.camera)) {
        this.#resizeController.setOrthographicFrustumSize(this.#orthoFrustumSize);
      }
      this.#resizeController.apply();
    } else {
      this.#resizeController = undefined;
      this.#applyStaticSize(options.canvas);
    }
  }

  #orthoFrustumSize = 10;

  get camera(): Camera {
    return this.#camera;
  }

  get canRender(): boolean {
    if (this.#resizeController) {
      return this.#resizeController.canRender;
    }
    return this.#hasNonZeroCanvasSize();
  }

  setCamera(camera: Camera, ownership: Ownership = 'external'): void {
    this.#assertNotDisposed();
    const previous = this.#camera;
    this.#camera = this.#ownership.register(camera, ownership);
    this.#notifyCameraChanged(previous, this.#camera);
    this.#resizeController?.apply();
    this.#pipeline.setSize(this.#currentSize());
  }

  onCameraChanged(listener: (event: CameraChangedEvent) => void): Disposable {
    this.#cameraChangedListeners.add(listener);
    return {
      dispose: () => {
        this.#cameraChangedListeners.delete(listener);
      },
    };
  }

  own(scope: FeatureScope, object: Object3D): void {
    const disposable = this.#ownedObjects.own(scope, object);
    scope.addCleanup(disposable);
  }

  render(): void {
    this.#assertNotDisposed();
    if (!this.canRender) {
      return;
    }

    this.#pipeline.render({
      scene: this.scene,
      camera: this.#camera,
      renderer: this.renderer,
    });
  }

  inspect(): RenderingSnapshot {
    return {
      width: this.#resizeController?.width ?? 0,
      height: this.#resizeController?.height ?? 0,
      pixelRatio: resolvePixelRatio(this.#pixelRatioOption),
      canRender: this.canRender,
      sceneOwnership: this.#ownership.get(this.scene) ?? 'external',
      rendererOwnership: this.#ownership.get(this.renderer) ?? 'external',
      cameraOwnership: this.#ownership.get(this.#camera) ?? 'external',
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.#resizeController?.dispose();
    this.#pipeline.dispose();
    this.#cameraChangedListeners.clear();

    if (this.#ownership.shouldDispose(this.renderer)) {
      this.renderer.dispose();
    }
  }

  #notifyCameraChanged(previous: Camera, current: Camera): void {
    const event: CameraChangedEvent = { previous, current };
    for (const listener of this.#cameraChangedListeners) {
      listener(event);
    }
  }

  #currentSize(): RenderSize {
    return {
      width: this.#resizeController?.width ?? 0,
      height: this.#resizeController?.height ?? 0,
      pixelRatio: resolvePixelRatio(this.#pixelRatioOption),
    };
  }

  #applyStaticSize(canvas: HTMLCanvasElement): void {
    const width = Math.max(0, Math.floor(canvas.clientWidth));
    const height = Math.max(0, Math.floor(canvas.clientHeight));
    const pixelRatio = resolvePixelRatio(this.#pixelRatioOption);

    if (width > 0 && height > 0) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
      this.#updateCameraAspect(width, height);
    }

    this.#pipeline.setSize({ width, height, pixelRatio });
  }

  #updateCameraAspect(width: number, height: number): void {
    const aspect = width / height;
    const camera = this.#camera;

    if (isPerspectiveCamera(camera)) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      return;
    }

    if (isOrthographicCamera(camera)) {
      const halfWidth = (this.#orthoFrustumSize * aspect) / 2;
      const halfHeight = this.#orthoFrustumSize / 2;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
    }
  }

  #hasNonZeroCanvasSize(): boolean {
    return this.#canvas.clientWidth > 0 && this.#canvas.clientHeight > 0;
  }

  #readAspect(canvas: HTMLCanvasElement): number {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) {
      return 1;
    }
    return width / height;
  }

  #isResizeEnabled(resize: RenderingInitOptions['resize']): boolean {
    if (resize === undefined) {
      return true;
    }
    if (typeof resize === 'boolean') {
      return resize;
    }
    return resize.enabled ?? true;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new ThrexusError('APP_STATE', 'Rendering runtime is disposed.');
    }
  }
}
