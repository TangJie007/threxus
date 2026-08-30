/**
 * 演示桥接：把 Selection / Stats / Postprocessing / Labels 暴露给 Vue UI。
 */

import type {
  LabelsServiceType,
  PostprocessingServiceType,
  RuntimeStats,
  SelectionServiceType,
  StatsServiceType,
  ThreeFeature,
} from '@threxus/runtime';
import {
  LabelsService,
  PostprocessingService,
  SelectionService,
  StatsService,
} from '@threxus/runtime';

export interface CubeDemoBridge {
  selection: SelectionServiceType | null;
  stats: StatsServiceType | null;
  postprocessing: PostprocessingServiceType | null;
  labels: LabelsServiceType | null;
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
    dependencies: [
      SelectionService,
      StatsService,
      PostprocessingService,
      LabelsService,
    ],
    setup(context) {
      const selection = context.inject(SelectionService);
      const stats = context.inject(StatsService);
      const postprocessing = context.inject(PostprocessingService);
      const labels = context.inject(LabelsService);

      bridge.selection = selection;
      bridge.stats = stats;
      bridge.postprocessing = postprocessing;
      bridge.labels = labels;

      const syncSelectionLabels = (
        selected: readonly import('three').Object3D[],
      ): void => {
        labels.clear();
        for (const [index, object] of selected.entries()) {
          const name = object.name || object.uuid.slice(0, 8);
          const el = document.createElement('div');
          el.className = 'cube-label-chip';
          el.textContent = name;
          el.style.cssText =
            'padding:2px 8px;border-radius:4px;background:rgba(15,23,42,.82);color:#e2e8f0;font:600 12px/1.4 sans-serif;white-space:nowrap;';
          labels.add({
            id: `sel-${index}`,
            anchor: object,
            element: el,
            offset: [0, 0.75, 0],
          });
        }
      };

      context.addCleanup(
        selection.onChange((selected) => {
          bridge.selectedNames = selected.map(
            (object) => object.name || object.uuid.slice(0, 8),
          );
          syncSelectionLabels(selected);
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

      log('M11 demo-bridge：Selection / Stats / Postprocessing / Labels 已连接');
    },
  };
}
