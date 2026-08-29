/**
 * 渲染运行时：Scene / Camera / Renderer、Resize、Pipeline、Stage 与临时渲染队列。
 *
 * 在 App start 时初始化，Feature setup 期间通过 ThreeContext.rendering 访问。
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
import { RenderOperationQueue } from './RenderOperationQueue';
import type { RenderStage } from './RenderStage';
import { resolveRenderer, resolveScene } from './RendererFactory';
import {
  captureRendererState,
  restoreRendererState,
  withRendererStateGuard,
} from './RendererStateGuard';
import { RenderingRegistry } from './RenderingRegistry';
import { ResizeController } from './ResizeController';
import {
  createScopedRendering,
  type ScopedRendering,
} from './ScopedRendering';
import type {
  CameraChangedEvent,
  Ownership,
  RenderContext,
  RenderSize,
  RenderingInitOptions,
} from './types';
import {
  isOrthographicCamera,
  isOrthographicCameraOptions,
  isPerspectiveCamera,
} from './types';
import { ContextRestoreRegistry } from './ContextRestoreRegistry';
import type { GraphicsState } from './GraphicsState';
import { WebGLContextController } from './WebGLContextController';

export interface RenderingSnapshot {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly canRender: boolean;
  readonly sceneOwnership: Ownership;
  readonly rendererOwnership: Ownership;
  readonly cameraOwnership: Ownership;
  readonly pipeline: string;
  readonly pipelineOwner: string | null;
  readonly stages: number;
  readonly graphicsState: GraphicsState;
}

export class RenderingRuntime implements Disposable {
  readonly scene: Scene;
  readonly renderer: WebGLRenderer;
  readonly #canvas: HTMLCanvasElement;
  readonly #ownership = new CoreObjectOwnership();
  readonly #ownedObjects = new OwnedObjectRegistry();
  readonly #defaultPipeline = new DirectRenderPipeline();
  readonly #registry: RenderingRegistry;
  readonly #operationQueue = new RenderOperationQueue();
  readonly #contextRegistry = new ContextRestoreRegistry();
  readonly #resizeController: ResizeController | undefined;
  readonly #pixelRatioOption: RenderingInitOptions['pixelRatio'];
  readonly #cameraChangedListeners = new Set<
    (event: CameraChangedEvent) => void
  >();
  readonly #onGraphicsStateChange:
    | ((state: GraphicsState) => void)
    | undefined;
  #contextController: WebGLContextController | undefined;

  #camera: Camera;
  #disposed = false;
  #orthoFrustumSize = 10;

  constructor(options: RenderingInitOptions) {
    this.#canvas = options.canvas;
    this.#registry = new RenderingRegistry(this.#defaultPipeline);

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

    const resizeEnabled = this.#isResizeEnabled(options.resize);
    if (resizeEnabled) {
      this.#resizeController = new ResizeController({
        canvas: options.canvas,
        renderer: this.renderer,
        getCamera: () => this.#camera,
        getPixelRatio: () => resolvePixelRatio(this.#pixelRatioOption),
        onResize: (size) => {
          this.#registry.pipeline.setSize(size);
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

    this.#onGraphicsStateChange = options.onGraphicsStateChange;
    this.#contextController = new WebGLContextController({
      canvas: options.canvas,
      getPipeline: () => this.#registry.pipeline,
      registry: this.#contextRegistry,
      onGraphicsStateChange: (state) => {
        this.#onGraphicsStateChange?.(state);
      },
      syncSize: () => {
        if (this.#resizeController) {
          this.#resizeController.apply();
        } else {
          this.#applyStaticSize(this.#canvas);
        }
      },
      requestFullRender: () => {
        if (this.canRender && this.graphicsState === 'available') {
          this.render();
        }
      },
    });
  }

  get camera(): Camera {
    return this.#camera;
  }

  get pipeline(): RenderPipeline {
    return this.#registry.pipeline;
  }

  get graphicsState(): GraphicsState {
    return this.#contextController?.state ?? 'available';
  }

  get canRender(): boolean {
    if (this.graphicsState !== 'available') {
      return false;
    }
    if (this.#resizeController) {
      return this.#resizeController.canRender;
    }
    return this.#hasNonZeroCanvasSize();
  }

  createScope(scope: FeatureScope): ScopedRendering {
    return createScopedRendering(this, scope);
  }

  onContextLost(
    scopeId: string,
    callback: () => void,
  ): Disposable {
    return this.#contextRegistry.onLost(scopeId, callback);
  }

  onContextRestored(
    scopeId: string,
    callback: () => void | Promise<void>,
  ): Disposable {
    return this.#contextRegistry.onRestored(scopeId, callback);
  }

  /** 测试用：模拟 webglcontextlost。 */
  simulateContextLost(): void {
    this.#contextController?.simulateLost();
  }

  /** 测试用：模拟 webglcontextrestored。 */
  simulateContextRestored(): Promise<void> {
    return this.#contextController?.simulateRestored() ?? Promise.resolve();
  }

  setCamera(camera: Camera, ownership: Ownership = 'external'): void {
    this.#assertNotDisposed();
    const previous = this.#camera;
    this.#camera = this.#ownership.register(camera, ownership);
    this.#notifyCameraChanged(previous, this.#camera);
    this.#resizeController?.apply();
    this.#registry.pipeline.setSize(this.#currentSize());
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

  setPipeline(pipeline: RenderPipeline, owner: string): void {
    this.#assertNotDisposed();
    this.#registry.setPipeline(pipeline, owner);
    pipeline.setSize(this.#currentSize());
  }

  async restoreDefaultPipeline(owner: string): Promise<void> {
    const previous = this.#registry.restoreDefaultPipeline(owner);
    this.#defaultPipeline.setSize(this.#currentSize());
    if (previous) {
      await previous.dispose();
    }
  }

  addStage(stage: RenderStage, scopeId: string): Disposable {
    this.#assertNotDisposed();
    const registered = this.#registry.addStage(stage, scopeId);
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        this.#registry.removeStage(registered);
      },
    };
  }

  withRendererState<T>(
    task: (renderer: WebGLRenderer) => T | Promise<T>,
  ): Promise<T> {
    this.#assertNotDisposed();
    return this.#operationQueue.runExclusive(() =>
      withRendererStateGuard(this.renderer, task),
    );
  }

  render(): void {
    this.#assertNotDisposed();
    if (!this.canRender) {
      return;
    }

    this.#operationQueue.runFrame(() => {
      const context = this.#createRenderContext();
      this.#runStages('before-main-render', context);
      this.#registry.pipeline.render(context);
      this.#runStages('after-main-render', context);
      this.#runStages('overlay', context);
    });
  }

  inspect(): RenderingSnapshot {
    const registry = this.#registry.inspect();
    return {
      width: this.#resizeController?.width ?? 0,
      height: this.#resizeController?.height ?? 0,
      pixelRatio: resolvePixelRatio(this.#pixelRatioOption),
      canRender: this.canRender,
      sceneOwnership: this.#ownership.get(this.scene) ?? 'external',
      rendererOwnership: this.#ownership.get(this.renderer) ?? 'external',
      cameraOwnership: this.#ownership.get(this.#camera) ?? 'external',
      pipeline: registry.pipelineName,
      pipelineOwner: registry.pipelineOwner,
      stages: registry.stages,
      graphicsState: this.graphicsState,
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;

    this.#contextController?.dispose();
    this.#contextController = undefined;
    this.#contextRegistry.clear();
    this.#resizeController?.dispose();

    const custom = this.#registry.isCustomPipeline
      ? this.#registry.pipeline
      : null;
    this.#registry.clear();
    void this.#defaultPipeline.dispose();
    if (custom) {
      void custom.dispose();
    }

    this.#cameraChangedListeners.clear();

    if (this.#ownership.shouldDispose(this.renderer)) {
      this.renderer.dispose();
    }
  }

  #runStages(
    phase: 'before-main-render' | 'after-main-render' | 'overlay',
    context: RenderContext,
  ): void {
    for (const stage of this.#registry.stagesFor(phase)) {
      const snapshot = captureRendererState(this.renderer);
      try {
        stage.render(context);
      } finally {
        restoreRendererState(this.renderer, snapshot);
      }
    }
  }

  #createRenderContext(): RenderContext {
    return {
      scene: this.scene,
      camera: this.#camera,
      renderer: this.renderer,
    };
  }

  #notifyCameraChanged(previous: Camera, current: Camera): void {
    const event: CameraChangedEvent = { previous, current };
    for (const listener of this.#cameraChangedListeners) {
      listener(event);
    }
  }

  #currentSize(): RenderSize {
    return {
      width: this.#resizeController?.width ?? this.#canvas.clientWidth,
      height: this.#resizeController?.height ?? this.#canvas.clientHeight,
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

    this.#registry.pipeline.setSize({ width, height, pixelRatio });
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
