/**
 * AGV Feature：在工厂场景中 spawn AGV 实体。
 */

import { defineFeature } from '@threxus/runtime'
import { FactorySceneService } from '../factory/factory.feature'
import { FactoryModelsService } from '../models/models.service'
import { AgvEntity } from './agv.entity'

export const agvFeature = defineFeature({
  name: 'agv',
  dependencies: [FactorySceneService, FactoryModelsService],
  async setup(context) {
    const { world } = context.inject(FactorySceneService)
    const models = context.inject(FactoryModelsService)
    await context.spawn(
      AgvEntity,
      { models },
      { id: 'AGV-01', parent: world.root },
    )
  },
})
