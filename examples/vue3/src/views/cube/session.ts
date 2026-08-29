import {
  createThreeApp,
  type AppState,
  type RuntimeSnapshot,
  type ThreeApp,
} from '@threxus/runtime';
import { cubeCamera } from './config';
import { createRotatingBoxFeature } from './features/rotating-box';
import type { CubeLogger } from './types';

export interface CubeSessionOptions {
  readonly onLog?: CubeLogger;
  readonly onChange?: () => void;
}

/** 立方体页专用 ThreeApp 会话：Feature、相机、生命周期一体管理。 */
export class CubeSession {
  app: ThreeApp | null = null;
  state: AppState = 'created';
  snapshot: RuntimeSnapshot | null = null;
  error: string | null = null;

  private readonly logFn: CubeLogger;
  private readonly onChange?: () => void;
  private polling = false;

  constructor(options: CubeSessionOptions = {}) {
    this.logFn = options.onLog ?? (() => {});
    this.onChange = options.onChange;
  }

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    const runtime = createThreeApp({
      canvas,
      camera: cubeCamera,
    });

    runtime.use(createRotatingBoxFeature(this.logFn));

    this.app = runtime;
    this.refresh();

    this.logFn('调用 app.start()');

    try {
      await runtime.start();
      this.logFn('App 启动完成');
      this.startPolling();
    } catch (reason) {
      this.error = getErrorMessage(reason);
      this.logFn(`启动失败：${this.error}`);
    }

    this.refresh();
  }

  async destroy(): Promise<void> {
    this.polling = false;
    if (!this.app || this.app.state === 'disposed') {
      return;
    }

    try {
      await this.app.dispose();
    } catch (reason) {
      this.error = getErrorMessage(reason);
    }

    this.refresh();
  }

  private refresh(): void {
    if (this.app) {
      this.state = this.app.state;
      this.snapshot = this.app.inspect();
    }
    this.onChange?.();
  }

  private startPolling(): void {
    this.polling = true;

    const tick = (): void => {
      if (!this.polling) {
        return;
      }
      this.refresh();
      if (this.app?.state === 'running') {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}

function getErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
