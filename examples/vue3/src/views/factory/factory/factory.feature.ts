/**
 * Factory 场景 Feature：materials → world → build* → provide 场景 API。
 * 不再单独拆 Runtime Facade；UI/桥接直接 inject 本服务。
 */

import { Group, type Material } from 'three'
import {
  createServiceKey,
  defineFeature,
} from '@threxus/runtime'
import { buildMaterials, disposeMaterials, mat, statusMaterial } from '../materials/Presets'
import { loadModelAssets } from './models'
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
  provides: [FactorySceneService],
  async setup(context) {
    buildMaterials()
    context.addCleanup(() => disposeMaterials())

    const root = new Group()
    root.name = 'Factory'
    context.mount(root)

    const world: FactoryWorld = {
      root,
      bounds: FACTORY_BOUNDS,
      devices: [],
      animated: [],
      pipes: [],
      fences: [],
      scanRing: null,
      clippableMaterials: [],
      pendingInstances: new Map(),
      pendingInstanceOwners: new Map(),
      models: null,
    }

    const models = await loadModelAssets(async (url) => {
      const handle = await context.assets.acquireGLTF(url, {
        signal: context.signal,
      })
      const asset = context.mount(handle)
      return { scene: asset.scene }
    })
    world.models = models
    context.addCleanup(() => {
      models.dispose()
      world.models = null
    })

    buildGround(world)
    buildStructure(world)
    buildCeilingLights(world)
    buildLines(world)
    buildPipeRack(world)
    buildShelves(world)
    buildSafetyZones(world)
    buildInstancedModels(world)
    const scanRing = buildScanRing(world)
    context.addCleanup(() => {
      scanRing.dispose()
      world.scanRing = null
    })

    world.clippableMaterials.push(
      mat('floor') as Material,
      mat('steel') as Material,
      mat('machine') as Material,
      mat('plastic') as Material,
      mat('hazard') as Material,
    )

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
        const mesh = o as { geometry?: { dispose(): void } }
        mesh.geometry?.dispose()
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
      models,
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
          device.indicator.material = statusMaterial(status)
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
