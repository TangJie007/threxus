import {
  createThreeApp,
  type AppState,
  type CameraOptions,
  type RuntimeSnapshot,
  type ThreeApp,
  type ThreeFeature,
} from '@threxus/runtime';

export interface ThreeAppSessionOptions {
  readonly features:
    | ThreeFeature[]
    | ((log: (message: string) => void) => ThreeFeature[]);
  readonly camera?: CameraOptions;
  readonly onLog?: (message: string) => void;
  readonly onChange?: () => void;
}

const defaultCamera: CameraOptions = {
  type: 'perspective',
  position: [2, 2, 4],
  target: [0, 0, 0],
};

/** 与框架无关的 ThreeApp 页面会话，供 Vue 选项式组件在 mounted 里使用。 */
export class ThreeAppSession {
  app: ThreeApp | null = null;
  state: AppState = 'created';
  snapshot: RuntimeSnapshot | null = null;
  error: string | null = null;

  private readonly options: ThreeAppSessionOptions;
  private readonly logFn: (message: string) => void;
  private readonly onChange?: () => void;
  private polling = false;

  constructor(options: ThreeAppSessionOptions) {
    this.options = options;
    this.logFn = options.onLog ?? (() => {});
    this.onChange = options.onChange;
  }

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    const features =
      typeof this.options.features === 'function'
        ? this.options.features(this.logFn)
        : this.options.features;

    const runtime = createThreeApp({
      canvas,
      camera: this.options.camera ?? defaultCamera,
    });

    for (const feature of features) {
      runtime.use(feature);
    }

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

  async dispose(): Promise<void> {
    if (!this.app || this.app.state === 'disposed') {
      return;
    }

    this.polling = false;
    this.logFn('开始 dispose');
    this.refresh();

    try {
      await this.app.dispose();
    } catch (reason) {
      this.error = getErrorMessage(reason);
      this.logFn(`销毁失败：${this.error}`);
    }

    this.refresh();
    this.logFn('App 已完整销毁');
  }

  /** 路由离开时自动销毁。 */
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
