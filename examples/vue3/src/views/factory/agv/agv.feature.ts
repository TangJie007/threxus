/**
 * AGV Feature：在工厂场景中 spawn AGV 实体。
 */

import { defineFeature } from '@threxus/runtime'
import { FactorySceneService } from '../factory/factory.feature'
import { AgvEntity } from './agv.entity'

export const agvFeature = defineFeature({
  name: 'agv',
  dependencies: [FactorySceneService],
  async setup(context) {
    const { world, models, materials } = context.inject(FactorySceneService)
    await context.spawn(
      AgvEntity,
      { models, materials },
      { id: 'AGV-01', parent: world.root },
    )
  },
})
