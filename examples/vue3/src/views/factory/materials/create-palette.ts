/**
 * 工厂场景 PBR 调色板：创建一次、多处复用、随 Feature 生命周期 dispose。
 *
 * 纪律：
 * 1. 材质必须复用（同实例），不要在 build* 里 new。
 * 2. metalness 优先 0/1；中间值仅用于脏污/半氧化过渡。
 * 3. 无环境贴图时金属会发黑，靠 envMapIntensity 调高级感。
 */

import * as THREE from 'three'
import type { DeviceStatus } from '../data/devices'
import { brushedMetal, concrete, hazardStripes } from './ProceduralTextures'

export interface FactoryPalette {
  readonly floor: THREE.MeshStandardMaterial
  readonly steel: THREE.MeshStandardMaterial
  readonly machine: THREE.MeshStandardMaterial
  readonly plastic: THREE.MeshStandardMaterial
  readonly glass: THREE.MeshPhysicalMaterial
  readonly rubber: THREE.MeshStandardMaterial
  readonly hazard: THREE.MeshStandardMaterial
  readonly emissiveOk: THREE.MeshStandardMaterial
  readonly emissiveWarn: THREE.MeshStandardMaterial
  readonly emissiveErr: THREE.MeshStandardMaterial
  /** 设备状态 → 指示灯自发光材质 */
  statusMaterial(status: DeviceStatus): THREE.Material
  /** 剖切等需要批量挂 clippingPlanes 的实体材质 */
  readonly clippable: readonly THREE.Material[]
  dispose(): void
}

export function createFactoryPalette(): FactoryPalette {
  const pool: THREE.Material[] = []

  function own<T extends THREE.Material>(key: string, m: T): T {
    m.name = key
    pool.push(m)
    return m
  }

  const floorMaps = concrete(512, 40, 7)
  const floor = own(
    'floor',
    new THREE.MeshStandardMaterial({
      map: floorMaps.map,
      normalMap: floorMaps.normalMap,
      roughnessMap: floorMaps.roughnessMap,
      color: 0x8c98a6,
      roughness: 0.62,
      metalness: 0.06,
      envMapIntensity: 0.7,
    }),
  )
  floor.normalScale.set(0.55, 0.55)

  const steelMaps = brushedMetal(512, 2, '#9aa6b4')
  const steel = own(
    'steel',
    new THREE.MeshStandardMaterial({
      map: steelMaps.map,
      normalMap: steelMaps.normalMap,
      color: 0x8f9aa8,
      roughness: 0.42,
      metalness: 1.0,
      envMapIntensity: 1.15,
    }),
  )

  const machine = own(
    'machine',
    new THREE.MeshStandardMaterial({
      color: 0x5f6b7a,
      roughness: 0.48,
      metalness: 0.25,
      envMapIntensity: 0.9,
    }),
  )

  const plastic = own(
    'plastic',
    new THREE.MeshStandardMaterial({
      color: 0x2b3440,
      roughness: 0.75,
      metalness: 0.0,
      envMapIntensity: 0.5,
    }),
  )

  const glass = own(
    'glass',
    new THREE.MeshPhysicalMaterial({
      color: 0x9fd8e8,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.4,
    }),
  )

  const rubber = own(
    'rubber',
    new THREE.MeshStandardMaterial({
      color: 0x1c222b,
      roughness: 0.95,
      metalness: 0.0,
    }),
  )

  const hazard = own(
    'hazard',
    new THREE.MeshStandardMaterial({
      map: hazardStripes(256, 8),
      roughness: 0.7,
      metalness: 0.05,
    }),
  )

  const emissiveOk = own(
    'emissiveOk',
    new THREE.MeshStandardMaterial({
      color: 0x0b1a16,
      emissive: 0x2ee6a8,
      emissiveIntensity: 2.4,
      roughness: 0.3,
      metalness: 0,
      toneMapped: false,
    }),
  )
  const emissiveWarn = own(
    'emissiveWarn',
    new THREE.MeshStandardMaterial({
      color: 0x1a1408,
      emissive: 0xffb020,
      emissiveIntensity: 2.6,
      roughness: 0.3,
      metalness: 0,
      toneMapped: false,
    }),
  )
  const emissiveErr = own(
    'emissiveErr',
    new THREE.MeshStandardMaterial({
      color: 0x1a0a0c,
      emissive: 0xff4d5e,
      emissiveIntensity: 2.8,
      roughness: 0.3,
      metalness: 0,
      toneMapped: false,
    }),
  )

  const clippable: THREE.Material[] = [floor, steel, machine, plastic, hazard]

  return {
    floor,
    steel,
    machine,
    plastic,
    glass,
    rubber,
    hazard,
    emissiveOk,
    emissiveWarn,
    emissiveErr,
    clippable,
    statusMaterial(status) {
      if (status === 'error') return emissiveErr
      if (status === 'warn') return emissiveWarn
      return emissiveOk
    },
    dispose() {
      for (const m of pool) m.dispose()
      pool.length = 0
    },
  }
}
