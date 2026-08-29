/** RAF 抽象，便于单元测试注入手动驱动。 */
export interface RafDriver {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

/** 浏览器环境默认 RAF 驱动；Node 测试环境回退到 setTimeout。 */
export function createBrowserRafDriver(): RafDriver {
  if (
    typeof globalThis.requestAnimationFrame === 'function' &&
    typeof globalThis.cancelAnimationFrame === 'function'
  ) {
    return {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (id) => cancelAnimationFrame(id),
    };
  }

  let nextId = 1;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  return {
    request: (callback) => {
      const id = nextId++;
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          callback(
            typeof performance !== 'undefined' ? performance.now() : Date.now(),
          );
        }, 0),
      );
      return id;
    },
    cancel: (id) => {
      const timer = timers.get(id);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(id);
      }
    },
  };
}

/**
 * 手动 RAF 驱动：测试时调用 {@link tick} 推进帧。
 * 同一时刻最多保留一个待执行回调（与 Scheduler 规则一致）。
 */
export class ManualRafDriver implements RafDriver {
  #callback: FrameRequestCallback | undefined;
  #nextId = 1;
  #scheduledId: number | undefined;

  request(callback: FrameRequestCallback): number {
    const id = this.#nextId++;
    this.#callback = callback;
    this.#scheduledId = id;
    return id;
  }

  cancel(id: number): void {
    if (this.#scheduledId === id) {
      this.#callback = undefined;
      this.#scheduledId = undefined;
    }
  }

  tick(time: number): void {
    const callback = this.#callback;
    this.#callback = undefined;
    this.#scheduledId = undefined;
    callback?.(time);
  }

  get pending(): boolean {
    return this.#callback !== undefined;
  }
}
