/**
 * 剖切 Feature：依赖 factory-scene 的可剖切材质，对外提供 ClipService。
 */

import { createServiceKey, defineFeature } from '@threxus/runtime'
import { FactorySceneService } from '../factory/factory.feature'
import { ClipController } from '../fx/clip-controller'

export const ClipService = createServiceKey<ClipController>('factory-clip')

export const clipFeature = defineFeature({
  name: 'factory-clip',
  dependencies: [FactorySceneService],
  provides: [ClipService],
  setup(context) {
    const { world } = context.inject(FactorySceneService)

    context.renderer.localClippingEnabled = true
    context.addCleanup(() => {
      context.renderer.localClippingEnabled = false
    })

    const clip = new ClipController()
    clip.register(world.clippableMaterials)
    context.provide(ClipService, clip)
  },
})
