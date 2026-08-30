/**
 * Factory 场景 Feature：palette → world → build* → provide 场景 API。
 * 不再单独拆 Runtime Facade；UI/桥接直接 inject 本服务。
 */

import { Group } from 'three'
import {
  createServiceKey,
  defineFeature,
} from '@threxus/runtime'
import { createFactoryPalette } from '../materials/create-palette'
import { ProceduralTexturesService } from '../materials/textures.feature'
import { FactoryModelsService } from '../models/models.service'
import {
  FACTORY_BOUNDS,
  type FactorySceneApi,
  type FactoryWorld,
} from './types'
import type { DeviceRecord, DeviceStatus } from '../data/devices'
import { buildGround } from './elements/ground'
import { buildStructure } from './elements/structure'
import { buildCeilingLights } from './elements/ceiling-lights'
import { buildLines } from './elements/lines'
import { buildPipeRack } from './elements/pipes'
import { buildShelves } from './elements/shelves'
import { buildSafetyZones } from './elements/safety-zones'
import { buildInstancedModels } from './elements/instances'
import { buildScanRing } from './elements/scan-ring'

export const FactorySceneService =
  createServiceKey<FactorySceneApi>('factory-scene')

export const factorySceneFeature = defineFeature({
  name: 'factory-scene',
  dependencies: [ProceduralTexturesService, FactoryModelsService],
  provides: [FactorySceneService],
  async setup(context) {
    const textures = context.inject(ProceduralTexturesService)
    const models = context.inject(FactoryModelsService)
    const materials = createFactoryPalette(textures)
    context.addCleanup(() => materials.dispose())

    const root = new Group()
    root.name = 'Factory'
    context.mount(root)

    const world: FactoryWorld = {
      root,
      bounds: FACTORY_BOUNDS,
      materials,
      textures,
      devices: [],
      animated: [],
      pipes: [],
      fences: [],
      scanRing: null,
      clippableMaterials: [...materials.clippable],
      pendingInstances: new Map(),
      pendingInstanceOwners: new Map(),
    }

    buildGround(world)
    buildStructure(world)
    buildCeilingLights(world)
    buildLines(world, models)
    buildPipeRack(world)
    buildShelves(world)
    buildSafetyZones(world)
    buildInstancedModels(world, models)
    const scanRing = buildScanRing(world)
    context.addCleanup(() => {
      scanRing.dispose()
      world.scanRing = null
    })

    let elapsed = 0
    context.onUpdate(({ delta }) => {
      elapsed += delta
      for (let i = 0; i < world.animated.length; i++) {
        world.animated[i](delta, elapsed)
      }
      world.scanRing?.update(delta)
    })

    context.addCleanup(() => {
      world.pipes.forEach((p) => p.dispose())
      world.fences.forEach((f) => f.dispose())
      world.root.traverse((o) => {
        const mesh = o as import('three').Mesh
        if (
          mesh.isMesh &&
          !models.isManagedGeometry(mesh.geometry)
        ) {
          mesh.geometry.dispose()
        }
      })
      world.root.clear()
      world.devices.length = 0
      world.animated.length = 0
      world.pipes.length = 0
      world.fences.length = 0
      world.clippableMaterials.length = 0
    })

    const api: FactorySceneApi = {
      world,
      materials,
      get root() {
        return world.root
      },
      get devices() {
        return world.devices
      },
      get scanRing() {
        if (!world.scanRing) {
          throw new Error('factory-scene: scanRing not ready')
        }
        return world.scanRing
      },
      applyStatus(device: DeviceRecord, status: DeviceStatus) {
        device.status = status
        if (device.indicator) {
          device.indicator.material = materials.statusMaterial(status)
        }
        if (device.beacon) {
          device.beacon.visible = status === 'error'
        }
      },
      setFlowEnabled(v: boolean) {
        for (const p of world.pipes) p.flowEnabled = v
      },
      setFenceAlert(v: boolean) {
        for (const f of world.fences) f.alert = v
      },
      findDevice(id: string) {
        return world.devices.find((d) => d.id === id)
      },
    }

    context.provide(FactorySceneService, api)
  },
})

export { FACTORY_BOUNDS }
export type {
  FactorySceneApi,
  FactoryWorld,
  FactoryAnimator,
  FactoryBounds,
} from './types'
