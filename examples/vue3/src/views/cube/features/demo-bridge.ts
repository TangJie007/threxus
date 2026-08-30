/**
 * 演示桥接：把 Selection / Stats / Postprocessing 服务暴露给 Vue UI。
 */

import type {
  PostprocessingServiceType,
  RuntimeStats,
  SelectionServiceType,
  StatsServiceType,
  ThreeFeature,
} from '@threxus/runtime';
import {
  PostprocessingService,
  SelectionService,
  StatsService,
} from '@threxus/runtime';

export interface CubeDemoBridge {
  selection: SelectionServiceType | null;
  stats: StatsServiceType | null;
  postprocessing: PostprocessingServiceType | null;
  selectedNames: string[];
  latestStats: RuntimeStats | null;
  passRestores: number;
}

export function createDemoBridgeFeature(
  bridge: CubeDemoBridge,
  log: (message: string) => void,
): ThreeFeature {
  return {
    name: 'demo-bridge',
    dependencies: [SelectionService, StatsService, PostprocessingService],
    setup(context) {
      const selection = context.inject(SelectionService);
      const stats = context.inject(StatsService);
      const postprocessing = context.inject(PostprocessingService);

      bridge.selection = selection;
      bridge.stats = stats;
      bridge.postprocessing = postprocessing;

      context.addCleanup(
        selection.onChange((selected) => {
          bridge.selectedNames = selected.map(
            (object) => object.name || object.uuid.slice(0, 8),
          );
          if (selected.length === 0) {
            log('M11 selection：清空');
          } else {
            log(`M11 selection：${bridge.selectedNames.join(', ')}`);
          }
        }),
      );

      context.addCleanup(
        postprocessing.addPass({
          id: 'cube-demo-pass',
          priority: 0,
          render() {
            // 演示 Pass：不改画面，只参与 Pipeline 路径
          },
          restore() {
            bridge.passRestores += 1;
            log(`M10/M11 postprocessing.restore ×${bridge.passRestores}`);
          },
        }),
      );

      context.onUpdate(() => {
        bridge.latestStats = stats.latest;
      });

      context.onContextLost(() => {
        log('M10 onContextLost');
      });
      context.onContextRestored(async () => {
        log('M10 onContextRestored');
      });

      log('M11 demo-bridge：Selection / Stats / Postprocessing 已连接');
    },
  };
}
