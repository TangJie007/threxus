import type { Camera, OrthographicCamera, PerspectiveCamera, WebGLRenderer } from 'three';
import type { Disposable } from '../lifecycle/Disposable';
import {
  isOrthographicCamera,
  isPerspectiveCamera,
  type RenderSize,
} from './types';

export interface ResizeControllerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly getCamera: () => Camera;
  readonly getPixelRatio: () => number;
  readonly onResize?: (size: RenderSize) => void;
}

/**
 * 监听 Canvas 尺寸变化，更新 Renderer 与 Camera 投影。
 * 默认使用 ResizeObserver，而非 window.resize。
 */
export class ResizeController implements Disposable {
  readonly #canvas: HTMLCanvasElement;
  readonly #renderer: WebGLRenderer;
  readonly #getCamera: () => Camera;
  readonly #getPixelRatio: () => number;
  readonly #onResize: ((size: RenderSize) => void) | undefined;
  readonly #observer: ResizeObserver | undefined;
  #width = 0;
  #height = 0;
  #orthoFrustumSize = 10;

  constructor(options: ResizeControllerOptions) {
    this.#canvas = options.canvas;
    this.#renderer = options.renderer;
    this.#getCamera = options.getCamera;
    this.#getPixelRatio = options.getPixelRatio;
    this.#onResize = options.onResize;

    if (typeof ResizeObserver === 'function') {
      this.#observer = new ResizeObserver(() => {
        this.apply();
      });
      this.#observer.observe(this.#canvas);
    }
  }

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  get canRender(): boolean {
    return this.#width > 0 && this.#height > 0;
  }

  apply(): RenderSize {
    const pixelRatio = this.#getPixelRatio();
    const width = Math.max(0, Math.floor(this.#canvas.clientWidth));
    const height = Math.max(0, Math.floor(this.#canvas.clientHeight));

    this.#width = width;
    this.#height = height;

    if (width > 0 && height > 0) {
      this.#renderer.setPixelRatio(pixelRatio);
      this.#renderer.setSize(width, height, false);
      this.#updateCameraProjection(width, height);
    }

    const size: RenderSize = { width, height, pixelRatio };
    this.#onResize?.(size);
    return size;
  }

  setOrthographicFrustumSize(size: number): void {
    this.#orthoFrustumSize = size;
    if (this.#width > 0 && this.#height > 0) {
      this.#updateCameraProjection(this.#width, this.#height);
    }
  }

  dispose(): void {
    this.#observer?.disconnect();
  }

  #updateCameraProjection(width: number, height: number): void {
    const aspect = width / height;
    const camera = this.#getCamera();

    if (isPerspectiveCamera(camera)) {
      this.#updatePerspectiveCamera(camera, aspect);
      return;
    }

    if (isOrthographicCamera(camera)) {
      this.#updateOrthographicCamera(camera, aspect);
    }
  }

  #updatePerspectiveCamera(camera: PerspectiveCamera, aspect: number): void {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  #updateOrthographicCamera(camera: OrthographicCamera, aspect: number): void {
    const halfWidth = (this.#orthoFrustumSize * aspect) / 2;
    const halfHeight = this.#orthoFrustumSize / 2;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }
}
