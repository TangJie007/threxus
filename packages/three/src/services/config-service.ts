/**
 * 配置服务：运行时配置存放与 zod 校验合并。
 */

import { Injectable } from '@threxus/core';
import type { PartialDeep } from 'type-fest';
import { z } from 'zod';

const threxusConfigSchema = z.object({
  assetConcurrency: z.number().int().positive().default(4),
  assetCacheMax: z.number().int().positive().default(128),
  debug: z.boolean().default(false),
});

export type ThrexusConfig = z.infer<typeof threxusConfigSchema>;

@Injectable()
export class ConfigService {
  private config: ThrexusConfig = threxusConfigSchema.parse({});

  /**
   * 用部分配置深度合并并校验。
   */
  set(partial: PartialDeep<ThrexusConfig>): ThrexusConfig {
    const merged = { ...this.config, ...partial };
    this.config = threxusConfigSchema.parse(merged);
    return this.config;
  }

  get(): Readonly<ThrexusConfig> {
    return this.config;
  }
}
