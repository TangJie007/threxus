/**
 * 材质 Feature：全局 PBR 预设，必须在几何构建前完成。
 */

import type { ThreeFeature } from '@threxus/runtime';
import { buildMaterials, disposeMaterials } from './lib/materials/Presets';
import { MaterialsReadyService } from './services';

export function createMaterialsFeature(): ThreeFeature {
  return {
    name: 'factory-materials',
    provides: [MaterialsReadyService],
    setup(context) {
      buildMaterials();
      context.addCleanup(() => disposeMaterials());
      context.provide(MaterialsReadyService, { ready: true });
    },
  };
}
