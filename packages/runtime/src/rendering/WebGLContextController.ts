/**
 * 监听 Canvas webglcontextlost / webglcontextrestored，驱动 GraphicsState。
 */

import { ThrexusError, toError } from '../errors';
import type { Disposable } from '../lifecycle/Disposable';
import type { ContextRestoreRegistry } from './ContextRestoreRegistry';
import type { GraphicsState } from './GraphicsState';
import type { RenderPipeline } from './RenderPipeline';

export interface WebGLContextControllerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly getPipeline: () => RenderPipeline;
  readonly registry: ContextRestoreRegistry;
  /** 丢失期间暂停帧工作；恢复成功后按需恢复。 */
  readonly onGraphicsStateChange: (state: GraphicsState) => void;
  /** 恢复后同步尺寸。 */
  readonly syncSize: () => void;
  /** 恢复后请求完整一帧。 */
  readonly requestFullRender: () => void;
}

export class WebGLContextController implements Disposable {
  readonly #canvas: HTMLCanvasElement;
  readonly #getPipeline: () => RenderPipeline;
  readonly #registry: ContextRestoreRegistry;
  readonly #onGraphicsStateChange: (state: GraphicsState) => void;
  readonly #syncSize: () => void;
  readonly #requestFullRender: () => void;
  readonly #onLost: EventListener;
  readonly #onRestored: EventListener;

  #state: GraphicsState = 'available';
  #disposed = false;
  #restorePromise: Promise<void> | undefined;

  constructor(options: WebGLContextControllerOptions) {
    this.#canvas = options.canvas;
    this.#getPipeline = options.getPipeline;
    this.#registry = options.registry;
    this.#onGraphicsStateChange = options.onGraphicsStateChange;
    this.#syncSize = options.syncSize;
    this.#requestFullRender = options.requestFullRender;

    this.#onLost = (event) => {
      this.#handleLost(event as Event);
    };
    this.#onRestored = () => {
      void this.#handleRestored();
    };

    this.#canvas.addEventListener('webglcontextlost', this.#onLost, false);
    this.#canvas.addEventListener(
      'webglcontextrestored',
      this.#onRestored,
      false,
    );
  }

  get state(): GraphicsState {
    return this.#state;
  }

  /** 测试 / 诊断用：模拟丢失。 */
  simulateLost(): void {
    const event = new Event('webglcontextlost', {
      cancelable: true,
    });
    this.#handleLost(event);
  }

  /** 测试 / 诊断用：模拟恢复。 */
  simulateRestored(): Promise<void> {
    return this.#handleRestored();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#canvas.removeEventListener('webglcontextlost', this.#onLost, false);
    this.#canvas.removeEventListener(
      'webglcontextrestored',
      this.#onRestored,
      false,
    );
  }

  #setState(state: GraphicsState): void {
    this.#state = state;
    this.#onGraphicsStateChange(state);
  }

  #handleLost(event: Event): void {
    if (this.#disposed) {
      return;
    }
    if (this.#state === 'lost' || this.#state === 'unavailable') {
      return;
    }

    event.preventDefault?.();
    this.#setState('lost');
    this.#registry.notifyLost();
  }

  async #handleRestored(): Promise<void> {
    if (this.#disposed) {
      return;
    }
    if (this.#state !== 'lost' && this.#state !== 'restoring') {
      return;
    }
    if (this.#restorePromise) {
      return this.#restorePromise;
    }

    this.#restorePromise = this.#runRestore();
    try {
      await this.#restorePromise;
    } finally {
      this.#restorePromise = undefined;
    }
  }

  async #runRestore(): Promise<void> {
    this.#setState('restoring');

    try {
      const pipeline = this.#getPipeline();
      if (pipeline.restore) {
        await pipeline.restore();
      }

      await this.#registry.notifyRestored();

      if (this.#disposed) {
        return;
      }

      this.#syncSize();
      this.#setState('available');
      this.#requestFullRender();
    } catch (error) {
      if (!this.#disposed) {
        this.#setState('unavailable');
      }
      const cause = toError(error);
      throw new ThrexusError(
        'GRAPHICS_RESTORE',
        `WebGL context restore failed: ${cause.message}`,
        { cause },
      );
    }
  }
}
