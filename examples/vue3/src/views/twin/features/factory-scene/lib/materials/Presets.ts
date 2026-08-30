import * as THREE from 'three'
import { brushedMetal, concrete, hazardStripes } from './ProceduralTextures'

/**
 * PBR 材质预设库。
 *
 * 工业级项目的材质纪律：
 * 1. 材质必须复用。100 台设备共用 6 个材质实例，而不是 new 600 次 ——
 *    材质实例数量直接决定 shader 编译次数和 drawcall 合批能力。
 * 2. 金属度（metalness）只有 0 或 1 两个值才物理正确。
 *    中间值只用于"脏污金属/半氧化表面"这类过渡态，滥用会让画面发灰。
 * 3. envMapIntensity 是 PBR 的"高级感旋钮"。没有环境贴图时金属就是一坨黑。
 */

export type MaterialKey =
  | 'floor'
  | 'steel'
  | 'machine'
  | 'plastic'
  | 'glass'
  | 'rubber'
  | 'hazard'
  | 'emissiveOk'
  | 'emissiveWarn'
  | 'emissiveErr'

const registry = new Map<string, THREE.Material>()
const pool: THREE.Material[] = []

function reg(key: string, m: THREE.Material): THREE.Material {
  m.name = key
  registry.set(key, m)
  pool.push(m)
  return m
}

export function buildMaterials(): void {
  // ---- 地坪：环氧自流平，有清漆层所以 roughness 偏低，能映出设备倒影 ----
  const floorMaps = concrete(512, 40, 7)
  const floor = new THREE.MeshStandardMaterial({
    map: floorMaps.map,
    normalMap: floorMaps.normalMap,
    roughnessMap: floorMaps.roughnessMap,
    color: 0x8c98a6,
    roughness: 0.62,
    metalness: 0.06,
    envMapIntensity: 0.7,
  })
  floor.normalScale.set(0.55, 0.55)
  reg('floor', floor)

  // ---- 钢结构：厂房立柱、桁架、设备骨架 ----
  const steelMaps = brushedMetal(512, 2, '#9aa6b4')
  reg(
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

  // ---- 设备外壳：喷涂钣金，metalness 必须低（涂层是非金属） ----
  reg(
    'machine',
    new THREE.MeshStandardMaterial({
      color: 0x5f6b7a,
      roughness: 0.48,
      metalness: 0.25,
      envMapIntensity: 0.9,
    }),
  )

  reg(
    'plastic',
    new THREE.MeshStandardMaterial({
      color: 0x2b3440,
      roughness: 0.75,
      metalness: 0.0,
      envMapIntensity: 0.5,
    }),
  )

  // ---- 观察窗 / 防护罩：用 transmission 会显著掉帧，产线设备多用 fake transparent ----
  reg(
    'glass',
    new THREE.MeshPhysicalMaterial({
      color: 0x9fd8e8,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false, // 透明件不写深度，否则会遮挡后面的设备
      envMapIntensity: 1.4,
    }),
  )

  // ---- 输送带：橡胶 ----
  reg(
    'rubber',
    new THREE.MeshStandardMaterial({
      color: 0x1c222b,
      roughness: 0.95,
      metalness: 0.0,
    }),
  )

  // ---- 安全通道 / 危险区地面 ----
  reg(
    'hazard',
    new THREE.MeshStandardMaterial({
      map: hazardStripes(256, 8),
      roughness: 0.7,
      metalness: 0.05,
    }),
  )

  // ---- 状态指示灯：自发光是 Bloom 的燃料 ----
  reg(
    'emissiveOk',
    new THREE.MeshStandardMaterial({
      color: 0x0b1a16,
      emissive: 0x2ee6a8,
      emissiveIntensity: 2.4,
      roughness: 0.3,
      metalness: 0,
      toneMapped: false, // 关掉 tonemapping，让高光真正超过 1.0，Bloom 才提取得出来
    }),
  )
  reg(
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
  reg(
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
}

export function mat(key: MaterialKey): THREE.Material {
  const m = registry.get(key)
  if (!m) throw new Error(`[Materials] 未构建的材质: ${key}，请先调用 buildMaterials()`)
  return m
}

export function allMaterials(): THREE.Material[] {
  return pool
}

export function disposeMaterials(): void {
  pool.forEach((m) => m.dispose())
  pool.length = 0
  registry.clear()
}

/** 设备状态 → 自发光材质 */
export function statusMaterial(status: DeviceStatus): THREE.Material {
  return status === 'error'
    ? mat('emissiveErr')
    : status === 'warn'
      ? mat('emissiveWarn')
      : mat('emissiveOk')
}

export type DeviceStatus = 'ok' | 'warn' | 'error' | 'idle'

export const STATUS_COLOR: Record<DeviceStatus, number> = {
  ok: 0x2ee6a8,
  warn: 0xffb020,
  error: 0xff4d5e,
  idle: 0x7d8ea3,
}

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  ok: '运行',
  warn: '告警',
  error: '故障',
  idle: '待机',
}
