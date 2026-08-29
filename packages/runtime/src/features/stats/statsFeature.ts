/**
 * 改进 Stats：采样上下文可观测指标。
 */

import type { ThreeFeature } from '../../feature/ThreeFeature';
import { createServiceKey } from '../../services/ServiceKey';

export interface RuntimeStats {
  readonly fps: number;
  readonly frame: number;
  readonly assetEntries: number;
  readonly assetRefs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly pipeline: string;
}

export interface StatsService {
  readonly latest: RuntimeStats | null;
  sample(): RuntimeStats;
}

export const StatsService = createServiceKey<StatsService>('stats');

export interface StatsFeatureOptions {
  readonly sampleEverySeconds?: number;
}

export function statsFeature(
  options: StatsFeatureOptions = {},
): ThreeFeature {
  const sampleEvery = options.sampleEverySeconds ?? 0;

  return {
    name: 'stats',
    provides: [StatsService],
    setup(context) {
      let latest: RuntimeStats | null = null;
      let accumulator = 0;
      let fps = 0;
      let frame = 0;

      const sample = (): RuntimeStats => {
        const assets = context.assets.inspect();
        const info = context.renderer.info;
        const snapshot: RuntimeStats = {
          fps,
          frame,
          assetEntries: assets.entries,
          assetRefs: assets.totalRefs,
          drawCalls: info?.render?.calls ?? 0,
          triangles: info?.render?.triangles ?? 0,
          geometries: info?.memory?.geometries ?? 0,
          textures: info?.memory?.textures ?? 0,
          pipeline: context.rendering.pipeline.name,
        };
        latest = snapshot;
        return snapshot;
      };

      context.provide(StatsService, {
        get latest() {
          return latest;
        },
        sample,
      });

      context.onUpdate(({ delta, frame: currentFrame }) => {
        frame = currentFrame;
        fps = Math.round(1 / Math.max(delta, 1e-6));
        accumulator += delta;
        if (sampleEvery <= 0 || accumulator >= sampleEvery) {
          sample();
          if (sampleEvery > 0) {
            accumulator = 0;
          }
        }
      });
    },
  };
}
