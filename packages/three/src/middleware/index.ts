/**
 * 纯函数中间件流水线（L4 横切层）。
 *
 * 无状态、可短路；业务逻辑不得写在中间件内。
 *
 * - {@link createPipeline}：异步链（Asset / Serialize / Interaction）
 * - {@link createSyncPipeline}：同步链（Render 帧路径必须同步）
 */

/** 异步链：调用下游 */
export type Next = () => void | Promise<void>;

/** 同步链：调用下游 */
export type SyncNext = () => void;

/**
 * 异步中间件：接收上下文与 next；不调用 next 即短路。
 */
export type Middleware<TContext> = (
  ctx: TContext,
  next: Next,
) => void | Promise<void>;

/**
 * 同步中间件：Render 等热路径专用，禁止返回 Promise。
 */
export type SyncMiddleware<TContext> = (
  ctx: TContext,
  next: SyncNext,
) => void;

/**
 * 异步流水线。
 */
export type Pipeline<TContext> = (
  ctx: TContext,
  terminal?: (ctx: TContext) => void | Promise<void>,
) => Promise<void>;

/**
 * 同步流水线。
 */
export type SyncPipeline<TContext> = (
  ctx: TContext,
  terminal?: (ctx: TContext) => void,
) => void;

/**
 * 从中间件列表创建异步流水线。
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

/**
 * 从中间件列表创建同步流水线（Render 帧路径使用）。
 *
 * @param middlewares - 按注册顺序执行
 */
export function createSyncPipeline<TContext>(
  middlewares: readonly SyncMiddleware<TContext>[] = [],
): SyncPipeline<TContext> {
  return (ctx, terminal) => {
    let index = -1;

    const dispatch = (i: number): void => {
      if (i <= index) {
        throw new Error('中间件 next() 不可重复调用。');
      }
      index = i;
      if (i === middlewares.length) {
        terminal?.(ctx);
        return;
      }
      const mw = middlewares[i]!;
      mw(ctx, () => dispatch(i + 1));
    };

    dispatch(0);
  };
}
