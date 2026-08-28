/**
 * 纯函数中间件流水线（L4 横切层）。
 *
 * 无状态、可短路；业务逻辑不得写在中间件内。
 */

/** 调用下游的函数 */
export type Next = () => void | Promise<void>;

/**
 * 中间件：接收上下文与 next；不调用 next 即短路。
 */
export type Middleware<TContext> = (
  ctx: TContext,
  next: Next,
) => void | Promise<void>;

/**
 * 已编译的流水线：顺序执行中间件，末尾执行 terminal。
 */
export type Pipeline<TContext> = (
  ctx: TContext,
  terminal?: (ctx: TContext) => void | Promise<void>,
) => Promise<void>;

/**
 * 从中间件列表创建流水线。
 *
 * @param middlewares - 按注册顺序执行
 */
export function createPipeline<TContext>(
  middlewares: readonly Middleware<TContext>[] = [],
): Pipeline<TContext> {
  return async (ctx, terminal) => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('中间件 next() 不可重复调用。');
      }
      index = i;
      if (i === middlewares.length) {
        await terminal?.(ctx);
        return;
      }
      const mw = middlewares[i]!;
      await mw(ctx, () => dispatch(i + 1));
    };

    await dispatch(0);
  };
}
