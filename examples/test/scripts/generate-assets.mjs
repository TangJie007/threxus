#!/usr/bin/env node
/**
 * 程序化 glTF 素材生成器。
 *
 * 用 Three.js 构造几何体 → 用 gltf-transform 写成真正的 .glb 文件。
 *
 * 为什么需要这个脚本（而不是直接下载现成模型）：
 *  · 下载的工业模型动辄几十 MB，且面数远超工业红线，还得再跑一遍优化流水线
 *  · 自己生成的模型**一定有正确的层级命名**（Base / J1 / J2 / J3 / Tool），
 *    这是工业机器人模型的命门 —— 代码里要按名字找关节去做动画
 *  · 完全离线，随项目走，团队协作时不会出现"你的模型我这儿打不开"
 *
 * 用法：
 *   node scripts/generate-assets.mjs                  # 全部生成
 *   node scripts/generate-assets.mjs robot-arm        # 只生成指定模型
 */
import * as THREE from 'three'
import { Document, NodeIO } from '@gltf-transform/core'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// 支持 --out <dir> 覆盖输出目录（便于先生成到临时目录做对比验证）
const outIdx = process.argv.indexOf('--out')
const OUT_DIR = outIdx > -1 && process.argv[outIdx + 1]
  ? resolve(process.cwd(), process.argv[outIdx + 1])
  : resolve(ROOT, 'public/assets/models')

// ============================================================ 材质定义

/**
 * glTF 的 PBR 参数与 Three.js 一一对应，但要注意：
 * metallicFactor / roughnessFactor 必须显式设置，
 * 默认 metallic=1 会让所有东西看起来像塑料镀铬。
 */
const MATERIALS = {
  steel: { baseColor: [0.56, 0.60, 0.66, 1], metallic: 1.0, roughness: 0.40 },
  paint: { baseColor: [0.37, 0.42, 0.48, 1], metallic: 0.25, roughness: 0.48 },
  plastic: { baseColor: [0.17, 0.20, 0.25, 1], metallic: 0.0, roughness: 0.75 },
  rubber: { baseColor: [0.11, 0.13, 0.17, 1], metallic: 0.0, roughness: 0.95 },
  accent: { baseColor: [0.85, 0.55, 0.12, 1], metallic: 0.1, roughness: 0.50 },
  emissiveGreen: {
    baseColor: [0.04, 0.10, 0.09, 1],
    metallic: 0,
    roughness: 0.3,
    emissive: [0.18, 0.90, 0.66],
  },
  glass: {
    baseColor: [0.62, 0.85, 0.91, 1],
    metallic: 0,
    roughness: 0.08,
    alpha: 0.25,
  },
}

// ============================================================ 几何工具

/** 创建一个已应用变换的 Box 几何体（glTF 里没有"变换过的几何体"，必须烘焙进顶点） */
function box(w, h, d, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d)
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3(tx, ty, tz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  )
  g.applyMatrix4(m)
  return g
}

function cyl(rt, rb, h, seg, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg)
  const m = new THREE.Matrix4()
  m.compose(
    new THREE.Vector3(tx, ty, tz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1),
  )
  g.applyMatrix4(m)
  return g
}

/** 把多个几何体合并成一个（同材质的零件合并 = 减少 draw call） */
function merge(geos) {
  const merged = mergeGeometriesLocal(geos)
  geos.forEach((g) => g.dispose())
  return merged
}

/**
 * 极简版 mergeGeometries（避免为了跑脚本再引入 addons 依赖）。
 * 只处理 position/normal/uv + index，足够本项目使用。
 */
function mergeGeometriesLocal(geos) {
  const out = new THREE.BufferGeometry()
  let vCount = 0
  let iCount = 0
  for (const g of geos) {
    vCount += g.getAttribute('position').count
    iCount += g.getIndex() ? g.getIndex().count : g.getAttribute('position').count
  }
  const pos = new Float32Array(vCount * 3)
  const nor = new Float32Array(vCount * 3)
  const idx = new Uint32Array(iCount)

  let vo = 0
  let io = 0
  for (const g of geos) {
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    pos.set(p.array.subarray(0, p.count * 3), vo * 3)
    if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3)

    const gi = g.getIndex()
    if (gi) {
      for (let i = 0; i < gi.count; i++) idx[io++] = gi.array[i] + vo
    } else {
      for (let i = 0; i < p.count; i++) idx[io++] = i + vo
    }
    vo += p.count
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  out.computeBoundingBox()
  return out
}

// ============================================================ glTF 写入

function createMaterial(doc, key) {
  const def = MATERIALS[key]
  const m = doc
    .createMaterial(key)
    .setBaseColorFactor(def.baseColor)
    .setMetallicFactor(def.metallic)
    .setRoughnessFactor(def.roughness)
  if (def.emissive) m.setEmissiveFactor(def.emissive)
  if (def.alpha !== undefined) {
    m.setAlphaMode('BLEND').setDoubleSided(true)
    m.getBaseColorFactor()[3] = def.alpha
  }
  return m
}

/** Three.BufferGeometry → glTF Primitive（含 POSITION 的 min/max，glTF 规范强制要求） */
function addMesh(doc, buffer, geo, material, name) {
  const prim = doc.createPrimitive().setMaterial(material)

  const p = geo.getAttribute('position')
  // POSITION 的 min/max 是 glTF 规范强制项，但新版 gltf-transform 会在写入时
  // 通过 getMin()/getMax() 自动计算，无需（也没有 setter）手动设置
  prim.setAttribute(
    'POSITION',
    doc
      .createAccessor(name + '_POS')
      .setType('VEC3')
      .setArray(new Float32Array(p.array))
      .setBuffer(buffer),
  )

  const n = geo.getAttribute('normal')
  if (n) {
    prim.setAttribute(
      'NORMAL',
      doc
        .createAccessor(name + '_NOR')
        .setType('VEC3')
        .setArray(new Float32Array(n.array))
        .setBuffer(buffer),
    )
  }

  // 不导出 UV！
  // 这批模型全部使用纯 PBR 参数（metallic/roughness 因子），没有任何贴图，
  // UV 就是纯浪费 —— 每个顶点省 8 字节，约占总体积的 25%。
  // 很多从建模软件导出的 glTF 都带着用不上的 UV，这是最常见的体积浪费源。

  const i = geo.getIndex()
  if (i) {
    // 顶点数 < 65536 时用 2 字节索引，索引数据直接省一半
    const vCount = p.count
    const arr =
      vCount > 65535 ? new Uint32Array(i.array) : new Uint16Array(i.array)
    prim.setIndices(
      doc
        .createAccessor(name + '_IDX')
        .setType('SCALAR')
        .setArray(arr)
        .setBuffer(buffer),
    )
  }

  return doc.createMesh(name).addPrimitive(prim)
}

function addNode(doc, { name, mesh, translation = [0, 0, 0], children = [] }) {
  const n = doc.createNode(name).setTranslation(translation)
  if (mesh) n.setMesh(mesh)
  children.forEach((c) => n.addChild(c))
  return n
}

// ============================================================ 模型定义

/**
 * 六轴工业机器人。
 *
 * 层级设计是重点 —— 真实工业机器人模型必须按关节拆节点，
 * 这样运行时才能通过 scene.getObjectByName('J1') 拿到关节做动画。
 * 如果所有零件都合并成一个 mesh，模型就"死"了，只能整体移动。
 */
function buildRobotArm(doc, buffer, mats) {
  // Base：固定底座
  const baseMesh = addMesh(
    doc,
    buffer,
    merge([
      cyl(0.55, 0.68, 0.5, 24, 0, 0.25, 0),
      cyl(0.30, 0.30, 0.08, 16, 0, 0.52, 0),
      box(0.9, 0.06, 0.9, 0, 0.03, 0),
    ]),
    mats.steel,
    'Base',
  )

  // J1：回转关节（绕 Y 轴）
  const j1Mesh = addMesh(
    doc,
    buffer,
    merge([
      box(0.5, 0.9, 0.5, 0, 0.45, 0),
      cyl(0.32, 0.32, 0.24, 20, 0, 0.9, 0, Math.PI / 2),
    ]),
    mats.paint,
    'J1_Shoulder',
  )

  // J2：大臂（绕 X 轴俯仰）
  const j2Mesh = addMesh(
    doc,
    buffer,
    merge([
      box(0.34, 1.9, 0.34, 0, 0.95, 0),
      cyl(0.22, 0.22, 0.3, 16, 0, 0, 0, Math.PI / 2),
      box(0.2, 0.14, 0.2, 0, 1.85, 0),
    ]),
    mats.paint,
    'J2_UpperArm',
  )

  // J3：小臂
  const j3Mesh = addMesh(
    doc,
    buffer,
    merge([
      box(0.26, 1.5, 0.26, 0, 0.75, 0),
      cyl(0.16, 0.16, 0.24, 14, 0, 0, 0, Math.PI / 2),
      box(0.18, 0.12, 0.18, 0, 1.45, 0),
    ]),
    mats.paint,
    'J3_ForeArm',
  )

  // Tool：末端执行器（含状态指示灯）
  const toolMesh = addMesh(
    doc,
    buffer,
    merge([
      cyl(0.1, 0.16, 0.42, 12, 0, 1.62, 0),
      cyl(0.05, 0.05, 0.12, 8, 0, 1.88, 0),
    ]),
    mats.steel,
    'Tool',
  )
  const lampMesh = addMesh(
    doc,
    buffer,
    merge([cyl(0.07, 0.07, 0.06, 10, 0, 1.42, 0.16)]),
    mats.emissiveGreen,
    'StatusLamp',
  )

  // 线缆（视觉细节，工业模型的"真实感"往往靠这些小东西）
  const cableMesh = addMesh(
    doc,
    buffer,
    merge([cyl(0.045, 0.045, 1.1, 8, -0.16, 1.15, -0.1, 0, 0, 0.12)]),
    mats.rubber,
    'Cable',
  )

  const tool = addNode(doc, {
    name: 'Tool',
    translation: [0, 0, 0],
    children: [
      addNode(doc, { name: 'Tool_Mesh', mesh: toolMesh }),
      addNode(doc, { name: 'StatusLamp', mesh: lampMesh }),
    ],
  })

  const j3 = addNode(doc, {
    name: 'J3_ForeArm',
    translation: [0, 1.9, 0],
    children: [addNode(doc, { name: 'J3_Mesh', mesh: j3Mesh }), tool],
  })

  const j2 = addNode(doc, {
    name: 'J2_UpperArm',
    translation: [0, 0.9, 0],
    children: [
      addNode(doc, { name: 'J2_Mesh', mesh: j2Mesh }),
      addNode(doc, { name: 'Cable', mesh: cableMesh }),
      j3,
    ],
  })

  const j1 = addNode(doc, {
    name: 'J1_Shoulder',
    translation: [0, 0.5, 0],
    children: [addNode(doc, { name: 'J1_Mesh', mesh: j1Mesh }), j2],
  })

  return addNode(doc, {
    name: 'RobotArm',
    children: [addNode(doc, { name: 'Base_Mesh', mesh: baseMesh }), j1],
  })
}

/** 输送带模块（4 米一段，可拼接） */
function buildConveyor(doc, buffer, mats) {
  const LEN = 4

  const frame = addMesh(
    doc,
    buffer,
    merge([
      box(LEN, 0.16, 1.9, 0, 1.0, 0),
      box(LEN, 0.3, 0.12, 0, 1.18, -1.0),
      box(LEN, 0.3, 0.12, 0, 1.18, 1.0),
      ...[-1, 1].map((s) => box(0.16, 0.95, 1.6, s * (LEN / 2 - 0.35), 0.5, 0)),
    ]),
    mats.steel,
    'Frame',
  )

  const belt = addMesh(doc, buffer, merge([box(LEN - 0.06, 0.07, 1.7, 0, 1.11, 0)]), mats.rubber, 'Belt')

  // 托辊：沿长度方向排列
  const rollers = []
  const N = 9
  for (let i = 0; i < N; i++) {
    rollers.push(
      cyl(0.1, 0.1, 1.75, 10, -LEN / 2 + 0.25 + i * ((LEN - 0.5) / (N - 1)), 1.03, 0, Math.PI / 2),
    )
  }
  const rollerMesh = addMesh(doc, buffer, merge(rollers), mats.steel, 'Rollers')

  // 端部驱动辊（橙色，工业设备的安全色标识）
  const driveMesh = addMesh(
    doc,
    buffer,
    merge([
      cyl(0.16, 0.16, 1.9, 14, -LEN / 2 + 0.05, 1.05, 0, Math.PI / 2),
      cyl(0.16, 0.16, 1.9, 14, LEN / 2 - 0.05, 1.05, 0, Math.PI / 2),
    ]),
    mats.accent,
    'DriveRollers',
  )

  return addNode(doc, {
    name: 'ConveyorModule',
    children: [
      addNode(doc, { name: 'Frame', mesh: frame }),
      addNode(doc, { name: 'Belt', mesh: belt }),
      addNode(doc, { name: 'Rollers', mesh: rollerMesh }),
      addNode(doc, { name: 'DriveRollers', mesh: driveMesh }),
    ],
  })
}

/** 电控柜（带观察窗、散热格栅、指示灯） */
function buildCabinet(doc, buffer, mats) {
  const body = addMesh(
    doc,
    buffer,
    merge([
      box(1.0, 2.0, 0.7, 0, 1.0, 0),
      box(1.06, 0.06, 0.76, 0, 2.03, 0),
      box(1.06, 0.08, 0.76, 0, 0.04, 0),
    ]),
    mats.paint,
    'Body',
  )

  const door = addMesh(
    doc,
    buffer,
    merge([
      box(0.02, 1.7, 0.6, 0.52, 1.05, 0),
      box(0.04, 0.16, 0.05, 0.55, 1.75, 0.2),
    ]),
    mats.plastic,
    'Door',
  )

  const window = addMesh(
    doc,
    buffer,
    merge([box(0.02, 0.5, 0.42, 0.54, 1.35, 0)]),
    mats.glass,
    'Window',
  )

  // 散热格栅
  const fins = []
  for (let i = 0; i < 10; i++) fins.push(box(0.03, 0.04, 0.42, 0.52, 0.35 + i * 0.07, 0))
  const ventMesh = addMesh(doc, buffer, merge(fins), mats.plastic, 'Vent')

  const lampMesh = addMesh(
    doc,
    buffer,
    merge([
      cyl(0.055, 0.055, 0.05, 12, 0.55, 1.92, -0.18, Math.PI / 2),
      cyl(0.055, 0.055, 0.05, 12, 0.55, 1.92, 0, Math.PI / 2),
    ]),
    mats.emissiveGreen,
    'StatusLamp',
  )

  return addNode(doc, {
    name: 'ControlCabinet',
    children: [
      addNode(doc, { name: 'Body', mesh: body }),
      addNode(doc, { name: 'Door', mesh: door }),
      addNode(doc, { name: 'Window', mesh: window }),
      addNode(doc, { name: 'Vent', mesh: ventMesh }),
      addNode(doc, { name: 'StatusLamp', mesh: lampMesh }),
    ],
  })
}

/** AGV 自动导引运输车 */
function buildAGV(doc, buffer, mats) {
  const chassis = addMesh(
    doc,
    buffer,
    merge([
      box(1.5, 0.34, 1.0, 0, 0.34, 0),
      box(1.56, 0.06, 1.06, 0, 0.52, 0),
    ]),
    mats.paint,
    'Chassis',
  )

  const cargo = addMesh(doc, buffer, merge([box(1.15, 0.46, 0.85, 0, 0.78, 0)]), mats.plastic, 'Cargo')

  const wheels = []
  for (const sx of [-0.5, 0.5])
    for (const sz of [-0.4, 0.4])
      wheels.push(cyl(0.15, 0.15, 0.13, 12, sx, 0.15, sz, 0, 0, Math.PI / 2))
  const wheelMesh = addMesh(doc, buffer, merge(wheels), mats.rubber, 'Wheels')

  const sensor = addMesh(
    doc,
    buffer,
    merge([
      cyl(0.07, 0.07, 0.06, 12, 0.78, 0.42, 0, 0, 0, Math.PI / 2),
      box(0.06, 0.1, 0.3, 0.78, 0.66, 0),
    ]),
    mats.emissiveGreen,
    'Sensor',
  )

  // 顶部警示灯
  const beacon = addMesh(
    doc,
    buffer,
    merge([cyl(0.06, 0.08, 0.12, 10, -0.55, 1.08, 0)]),
    mats.accent,
    'Beacon',
  )

  return addNode(doc, {
    name: 'AGV',
    children: [
      addNode(doc, { name: 'Chassis', mesh: chassis }),
      addNode(doc, { name: 'Cargo', mesh: cargo }),
      addNode(doc, { name: 'Wheels', mesh: wheelMesh }),
      addNode(doc, { name: 'Sensor', mesh: sensor }),
      addNode(doc, { name: 'Beacon', mesh: beacon }),
    ],
  })
}

// ============================================================ 主流程

const BUILDERS = {
  'robot-arm': buildRobotArm,
  conveyor: buildConveyor,
  cabinet: buildCabinet,
  agv: buildAGV,
}

const io = new NodeIO()
mkdirSync(OUT_DIR, { recursive: true })

const targets = process.argv.slice(2).filter((a) => BUILDERS[a])
const list = targets.length ? targets : Object.keys(BUILDERS)

const manifest = []
let totalBytes = 0

for (const key of list) {
  const doc = new Document()
  const buffer = doc.createBuffer()

  const mats = {}
  for (const k of Object.keys(MATERIALS)) mats[k] = createMaterial(doc, k)

  const root = BUILDERS[key](doc, buffer, mats)
  const scene = doc.createScene('Scene').addChild(root)
  doc.getRoot().setDefaultScene(scene)

  const out = resolve(OUT_DIR, `${key}.glb`)
  await io.write(out, doc)

  // 统计信息
  let tris = 0
  let meshes = 0
  doc
    .getRoot()
    .listMeshes()
    .forEach((m) => {
      meshes++
      m.listPrimitives().forEach((p) => {
        const idx = p.getIndices()
        tris += idx ? idx.getCount() / 3 : p.getAttribute('POSITION').getCount() / 3
      })
    })

  const size = statSync(out).size
  totalBytes += size
  const kb = (size / 1024).toFixed(1)

  manifest.push({
    file: `assets/models/${key}.glb`,
    name: root.getName(),
    meshes,
    triangles: Math.round(tris),
    materials: doc.getRoot().listMaterials().length,
    nodes: doc.getRoot().listNodes().length,
    sizeKB: +kb,
  })

  console.log(
    `✓ ${key.padEnd(14)} ${String(Math.round(tris)).padStart(6)} 面  ` +
      `${String(meshes).padStart(2)} mesh  ${String(kb).padStart(7)} KB  →  ${basename(out)}`,
  )
}

writeFileSync(
  resolve(OUT_DIR, 'manifest.json'),
  JSON.stringify({ generated: new Date().toISOString(), models: manifest }, null, 2),
)

console.log('─'.repeat(62))
console.log(`共 ${manifest.length} 个模型，合计 ${(totalBytes / 1024).toFixed(1)} KB`)
console.log(`输出目录: public/assets/models/`)
console.log(`清单文件: public/assets/models/manifest.json`)
console.log('\n这些模型已自动接入场景，启动项目即可看到。')
