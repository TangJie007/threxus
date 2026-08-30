/**
 * 工厂程序贴图 Feature：素材降级用的 Canvas 贴图缓存。
 */

import { createServiceKey, defineFeature } from '@threxus/runtime'
import {
  createProceduralTextures,
  type ProceduralTexturesApi,
} from './ProceduralTextures'

export type { ProceduralTexturesApi, SurfaceMaps } from './ProceduralTextures'

export const ProceduralTexturesService =
  createServiceKey<ProceduralTexturesApi>('factory-procedural-textures')

export const proceduralTexturesFeature = defineFeature({
  name: 'factory-procedural-textures',
  provides: [ProceduralTexturesService],
  setup(context) {
    const textures = createProceduralTextures()
    context.provide(ProceduralTexturesService, textures)
    context.addCleanup(() => textures.dispose())
  },
})
