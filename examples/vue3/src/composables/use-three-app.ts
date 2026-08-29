import {
  createThreeApp,
  type AppState,
  type RuntimeSnapshot,
  type ThreeApp,
  type ThreeFeature,
} from '@threxus/runtime';
import {
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type Ref,
} from 'vue';

export interface ThreeAppDemo {
  readonly canvasRef: Ref<HTMLCanvasElement | null>;
  readonly state: Ref<AppState>;
  readonly events: Ref<string[]>;
  readonly error: Ref<string | null>;
  readonly snapshot: Ref<RuntimeSnapshot | null>;
  dispose(): Promise<void>;
}

export function useThreeApp(
  createFeatures: (log: (message: string) => void) => ThreeFeature[],
): ThreeAppDemo {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const app = shallowRef<ThreeApp>();
  const state = ref<AppState>('created');
  const events = ref<string[]>([]);
  const error = ref<string | null>(null);
  const snapshot = ref<RuntimeSnapshot | null>(null);

  const log = (message: string): void => {
    events.value.push(message);
  };

  const refresh = (): void => {
    if (!app.value) {
      return;
    }
    state.value = app.value.state;
    snapshot.value = app.value.inspect();
  };

  const dispose = async (): Promise<void> => {
    if (!app.value || app.value.state === 'disposed') {
      return;
    }

    log('开始 dispose');
    const disposal = app.value.dispose();
    refresh();

    try {
      await disposal;
    } catch (reason) {
      error.value = getErrorMessage(reason);
    }

    refresh();
    log('App 已完整销毁');
  };

  onMounted(async () => {
    const canvas = canvasRef.value;
    if (!canvas) {
      error.value = 'Canvas 尚未挂载。';
      return;
    }

    const runtime = createThreeApp({ canvas });
    for (const feature of createFeatures(log)) {
      runtime.use(feature);
    }
    app.value = runtime;

    log('调用 app.start()');
    const start = runtime.start();
    refresh();

    try {
      await start;
      log('App 启动完成');
    } catch (reason) {
      error.value = getErrorMessage(reason);
      log(`启动失败：${error.value}`);
    }

    refresh();
  });

  onBeforeUnmount(() => {
    void dispose();
  });

  return {
    canvasRef,
    state,
    events,
    error,
    snapshot,
    dispose,
  };
}

function getErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
