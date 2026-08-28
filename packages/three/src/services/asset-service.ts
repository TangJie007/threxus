/**
 * 资源加载服务：按 key 缓存 Loader 结果，经 Asset 中间件链。
 *
 * 实体不进 DI；仅资源句柄由本服务管理。
 */

import { Injectable } from '@threxus/core';
import { LRUCache } from 'lru-cache';
import pLimit from 'p-limit';
import {
  createPipeline,
  type Middleware,
  type Pipeline,
} from '../middleware';

/** Asset 流水线上下文 */
export type AssetContext = {
  key: string;
  url: string;
  /** 中间件可改写实际请求 URL */
  resolvedUrl?: string;
  /** 缓存命中时由中间件/服务填入 */
  result?: unknown;
  /** 设为 true 跳过实际加载 */
  skipLoad?: boolean;
};

export type AssetLoader<T extends object = object> = (url: string) => Promise<T>;

@Injectable()
export class AssetService {
  private readonly cache = new LRUCache<string, object>({
    max: 128,
  });
  private readonly limit = pLimit(4);
  private readonly middlewares: Middleware<AssetContext>[] = [];
  private pipeline: Pipeline<AssetContext> = createPipeline();
  private readonly inflight = new Map<string, Promise<object>>();

  /**
   * 注册 Asset 中间件。
   */
  use(middleware: Middleware<AssetContext>): this {
    this.middlewares.push(middleware);
    this.pipeline = createPipeline(this.middlewares);
    return this;
  }

  /**
   * 按 key 加载；命中缓存则直接返回。
   */
  async load<T extends object>(
    key: string,
    url: string,
    loader: AssetLoader<T>,
  ): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = this.limit(async () => {
      const ctx: AssetContext = { key, url, resolvedUrl: url };
      await this.pipeline(ctx, async (c) => {
        if (c.skipLoad || c.result !== undefined) {
          return;
        }
        c.result = await loader(c.resolvedUrl ?? c.url);
      });
      const result = ctx.result as T;
      this.cache.set(key, result);
      return result;
    });

    this.inflight.set(key, promise);
    try {
      return (await promise) as T;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** 是否已缓存 */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** 读取缓存（不触发加载） */
  get<T extends object>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  /** 清除单个或全部缓存 */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
      return;
    }
    this.cache.clear();
  }
}
