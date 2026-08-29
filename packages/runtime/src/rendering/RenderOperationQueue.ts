/**
 * 渲染操作队列：主帧与临时渲染互斥，避免并发改 Renderer 状态。
 */

export class RenderOperationQueue {
  #busy = false;
  readonly #waiters: Array<() => void> = [];

  get busy(): boolean {
    return this.#busy;
  }

  /**
   * 同步执行主帧。若临时任务占用中则跳过本帧（避免阻塞 RAF）。
   * @returns 是否实际执行了帧回调
   */
  runFrame(task: () => void): boolean {
    if (this.#busy) {
      return false;
    }

    this.#busy = true;
    try {
      task();
      return true;
    } finally {
      this.#busy = false;
      this.#flushWaiters();
    }
  }

  /**
   * 排队执行互斥任务（临时 RT / 截图等）。
   * 等待当前主帧或其它 exclusive 结束后再跑。
   */
  async runExclusive<T>(task: () => T | Promise<T>): Promise<T> {
    await this.#acquire();
    try {
      return await task();
    } finally {
      this.#busy = false;
      this.#flushWaiters();
    }
  }

  #acquire(): Promise<void> {
    if (!this.#busy) {
      this.#busy = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.#waiters.push(() => {
        this.#busy = true;
        resolve();
      });
    });
  }

  #flushWaiters(): void {
    const next = this.#waiters.shift();
    if (next) {
      next();
    }
  }
}
