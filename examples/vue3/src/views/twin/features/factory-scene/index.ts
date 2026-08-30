/**
 * 工厂场景 Feature 组合入口。
 *
 * 顺序有依赖含义（FeatureGraph 也会按 provides/dependencies 拓扑排序）：
 * materials → root → models → 几何构建 → instances → scan-ring → runtime
 */

import type { ThreeFeature } from '@threxus/runtime';
import { createMaterialsFeature } from './materials';
import { createFactoryRootFeature } from './root';
import { createModelsFeature } from './models';
import { createGroundFeature } from './ground';
import { createStructureFeature } from './structure';
import { createCeilingLightsFeature } from './ceiling-lights';
import { createLinesFeature } from './lines';
import { createPipesFeature } from './pipes';
import { createShelvesFeature } from './shelves';
import { createAgvFeature } from './agv';
import { createSafetyZonesFeature } from './safety-zones';
import { createInstancesFeature } from './instances';
import { createScanRingFeature } from './scan-ring';
import { createFactoryRuntimeFeature } from './runtime';

export {
  FactorySceneService,
  FactoryWorldService,
  ModelAssetsService,
  type FactorySceneApi,
  type FactoryRuntime,
  type FactoryWorld,
} from './services';

export function createFactorySceneFeatures(): ThreeFeature[] {
  return [
    createMaterialsFeature(),
    createFactoryRootFeature(),
    createModelsFeature(),
    createGroundFeature(),
    createStructureFeature(),
    createCeilingLightsFeature(),
    createLinesFeature(),
    createPipesFeature(),
    createShelvesFeature(),
    createAgvFeature(),
    createSafetyZonesFeature(),
    createInstancesFeature(),
    createScanRingFeature(),
    createFactoryRuntimeFeature(),
  ];
}
