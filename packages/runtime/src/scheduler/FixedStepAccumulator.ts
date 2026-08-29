/**
 * 固定时间步累加器。
 *
 * 将可变 delta 拆成若干 fixedStep 供 onFixedUpdate 使用；
 * 单帧迭代次数受 maxStepsPerFrame 限制，防止死亡螺旋。
 */

export class FixedStepAccumulator {
  #accumulator = 0;

  constructor(
    readonly fixedStep: number,
    readonly maxStepsPerFrame: number,
  ) {}

  /** 消耗 delta，返回本帧应执行的固定步长列表。 */
  consume(delta: number): readonly number[] {
    if (this.fixedStep <= 0) {
      return [];
    }

    this.#accumulator += delta;
    const steps: number[] = [];

    while (
      this.#accumulator >= this.fixedStep &&
      steps.length < this.maxStepsPerFrame
    ) {
      steps.push(this.fixedStep);
      this.#accumulator -= this.fixedStep;
    }

    return steps;
  }

  reset(): void {
    this.#accumulator = 0;
  }
}
