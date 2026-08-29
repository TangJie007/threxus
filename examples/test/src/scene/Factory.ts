import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { mat, statusMaterial, type DeviceStatus } from '@/materials/Presets'
import { gridLines } from '@/materials/ProceduralTextures'
import { FlowPipe, makePipeCurve } from '@/fx/FlowPipe'
import { AlertBeacon, ScanRing } from '@/fx/ScanRing'
import { ElectricFence } from '@/fx/ElectricFence'
import { makeDeviceSeed, makeRng, type DeviceRecord } from '@/data/devices'
import { markPickable } from '@/core/Picker'
import { ModelAssets, type ModelKey } from './ModelAssets'

export interface FactoryBounds {
  width: number
  depth: number
  height: number
}

const BOUNDS: FactoryBounds = { width: 100, depth: 70, height: 11 }

/**
 * 程序化工厂场景。
 *
 * 这个文件是整个项目里"Three.js 内功"最密集的地方，集中演示了 6 个工业级技巧：
 *
 *  1. mergeGeometries  —— 15 根立柱 + 20 根桁架合并成 1 个 geometry，
 *                         静态结构从 35 个 drawcall 降到 1 个
 *  2. InstancedMesh    —— 输送带支腿、货架货箱这类"同形状不同变换"的物件，
 *                         用实例化后 200 个物体只占 1 个 drawcall
 *  3. LOD              —— 设备按距离切三档精度，远处降级到包围盒
 *  4. 共享材质          —— 全场只用 10 个材质实例，shader 编译一次
 *  5. 逻辑节点分层      —— userData.pickId 标记可拾取根节点，raycast 上溯查找
 *  6. 动画与数据解耦    —— 动画只依赖 delta，数据变化只改内存状态
 */
export class Factory {
  readonly root = new THREE.Group()
  readonly devices: DeviceRecord[] = []
  readonly bounds = BOUNDS

  /** 所有需要每帧更新的动画体 */
  private readonly animated: Array<(delta: number, elapsed: number) => void> = []
  private readonly pipes: FlowPipe[] = []
  private readonly fences: ElectricFence[] = []
  readonly scanRing: ScanRing
  /** 参与剖切的材质集合，交给 ClipController 统一管理 */
  readonly clippableMaterials: THREE.Material[] = []

  /** 外部 glTF 素材。为 null 时全程使用程序化几何体 */
  private readonly models: ModelAssets | null
  /** 待实例化的模型变换矩阵，收集完统一建 InstancedMesh */
  private readonly pendingInstances = new Map<ModelKey, THREE.Matrix4[]>()
  /** 每个实例归属的设备 id（下标与上面的矩阵一一对应） */
  private readonly pendingInstanceOwners = new Map<ModelKey, string[]>()

  constructor(models: ModelAssets | null = null) {
    this.root.name = 'Factory'
    this.models = models

    this.buildGround()
    this.buildStructure() // 合并几何
    this.buildCeilingLights()
    this.buildLines() // 产线 + 设备 + 指示灯（同时收集实例化变换）
    this.buildPipeRack() // 流动管道
    this.buildShelves() // InstancedMesh
    this.buildAGV()
    this.buildSafetyZones() // 电子围栏
    this.buildInstancedModels() // 把收集到的变换一次性实例化

    this.scanRing = new ScanRing(38, 0x40e0ff)
    this.scanRing.position.y = 0.02
    this.root.add(this.scanRing)

    // 剖切材质：只切实体，不切特效（特效是 additive 的，切了反而穿帮）
    this.clippableMaterials.push(
      mat('floor') as THREE.Material,
      mat('steel') as THREE.Material,
      mat('machine') as THREE.Material,
      mat('plastic') as THREE.Material,
      mat('hazard') as THREE.Material,
    )
  }

  // ============================================================ 地面

  private buildGround(): void {
    // 主地坪
    const floorGeo = new THREE.PlaneGeometry(BOUNDS.width, BOUNDS.depth)
    floorGeo.rotateX(-Math.PI / 2)
    const floor = new THREE.Mesh(floorGeo, mat('floor'))
    floor.receiveShadow = true
    floor.name = 'Ground'
    this.root.add(floor)

    // 网格线：叠一层半透明平面，比 GridHelper 的抗锯齿好得多
    const gridGeo = new THREE.PlaneGeometry(BOUNDS.width, BOUNDS.depth)
    gridGeo.rotateX(-Math.PI / 2)
    const gridMat = new THREE.MeshBasicMaterial({
      map: gridLines(512, 1),
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      color: 0x40e0ff,
    })
    const grid = new THREE.Mesh(gridGeo, gridMat)
    grid.position.y = 0.012
    grid.renderOrder = 1
    this.root.add(grid)

    // 安全通道（黄黑警示带），沿三条产线之间的走道
    for (const z of [-8, 8]) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.width - 8, 2.2), mat('hazard'))
      lane.rotateX(-Math.PI / 2)
      lane.position.set(0, 0.015, z)
      lane.receiveShadow = true
      this.root.add(lane)
    }
  }

  // ============================================================ 厂房钢结构（几何合并）

  /**
   * 关键优化：所有静态钢构件合并为一个 Mesh。
   * 代价是失去独立变换能力 —— 所以只有"建好就不动"的东西才适合合并。
   */
  private buildStructure(): void {
    const parts: THREE.BufferGeometry[] = []
    const colW = 0.55
    const spanX = 21
    const spanZ = 24

    // ---- 立柱 ----
    for (let ix = -2; ix <= 2; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const g = new THREE.BoxGeometry(colW, BOUNDS.height, colW)
        g.translate(ix * spanX, BOUNDS.height / 2, iz * spanZ)
        parts.push(g)
        // 柱脚加劲板
        const base = new THREE.BoxGeometry(colW * 2.2, 0.3, colW * 2.2)
        base.translate(ix * spanX, 0.15, iz * spanZ)
        parts.push(base)
      }
    }

    // ---- 纵向桁架（沿 X）----
    for (let iz = -1; iz <= 1; iz++) {
      const g = new THREE.BoxGeometry(BOUNDS.width - 6, 0.42, 0.42)
      g.translate(0, BOUNDS.height - 0.3, iz * spanZ)
      parts.push(g)
      // 桁架下弦斜撑
      for (let i = -6; i <= 6; i++) {
        const d = new THREE.BoxGeometry(0.22, 1.5, 0.22)
        d.translate(i * 7.5, BOUNDS.height - 1.1, iz * spanZ)
        parts.push(d)
      }
    }

    // ---- 横向联系梁（沿 Z）----
    for (let ix = -2; ix <= 2; ix++) {
      const g = new THREE.BoxGeometry(0.36, 0.36, spanZ * 2)
      g.translate(ix * spanX, BOUNDS.height - 0.3, 0)
      parts.push(g)
    }

    const merged = mergeGeometries(parts, false)
    parts.forEach((g) => g.dispose()) // 合并后原始 geometry 立刻释放，不留显存垃圾

    if (!merged) {
      console.error('[Factory] 几何合并失败')
      return
    }
    merged.computeBoundingSphere()

    const steel = new THREE.Mesh(merged, mat('steel'))
    steel.castShadow = true
    steel.receiveShadow = true
    steel.name = 'SteelStructure'
    // 静态物体：关闭矩阵自动更新，省掉每帧的矩阵重算
    steel.matrixAutoUpdate = false
    steel.updateMatrix()
    this.root.add(steel)
  }

  // ============================================================ 顶部灯带

  private buildCeilingLights(): void {
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x121820,
      emissive: 0xbfd8ff,
      emissiveIntensity: 1.6,
      roughness: 0.4,
      toneMapped: false,
    })
    // 4 条灯带，每条由若干段构成 —— 用 InstancedMesh
    const seg = new THREE.BoxGeometry(6, 0.18, 0.5)
    const count = 4 * 8
    const lamps = new THREE.InstancedMesh(seg, lampMat, count)
    lamps.castShadow = false
    const m = new THREE.Matrix4()
    let i = 0
    for (let row = -1; row <= 1; row += 2) {
      for (let k = 0; k < 8; k++) {
        m.makeTranslation((k - 3.5) * 8.6, BOUNDS.height - 0.75, row * 7)
        lamps.setMatrixAt(i++, m)
      }
    }
    lamps.instanceMatrix.needsUpdate = true
    lamps.name = 'CeilingLights'
    this.root.add(lamps)
  }

  // ============================================================ 产线与设备

  private buildLines(): void {
    const rng = makeRng(20260829)
    const lineZ = [-16, 0, 16]
    const stationX = [-24, -14.4, -4.8, 4.8, 14.4, 24]

    lineZ.forEach((z, li) => {
      this.buildConveyor(z, li)
      stationX.forEach((x, si) => {
        this.buildStation(x, z, li, si, rng)
      })
    })
  }

  /** 输送带：优先用 glTF 模块实例化，没有素材时回退到程序化几何体 */
  private buildConveyor(z: number, lineIndex: number): void {
    const len = 58
    const group = new THREE.Group()
    group.position.set(0, 0, z)

    if (this.models?.has('conveyor')) {
      // 用 4 米一段的输送带模块铺满 58 米：15 段 → 收集变换，稍后统一实例化
      const MODULE_LEN = 4
      const count = Math.round(len / MODULE_LEN)
      const list = this.pendingInstances.get('conveyor') ?? []
      for (let i = 0; i < count; i++) {
        const x = -len / 2 + MODULE_LEN / 2 + i * (len / count)
        list.push(new THREE.Matrix4().makeTranslation(x, 0, z))
      }
      this.pendingInstances.set('conveyor', list)
    } else {
      // 降级：程序化带体 + 侧栏 + 支腿 + 托辊
      const belt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 1.9), mat('rubber'))
      belt.position.y = 1.05
      belt.castShadow = true
      belt.receiveShadow = true
      group.add(belt)

      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.12), mat('steel'))
        rail.position.set(0, 1.22, s * 1.0)
        rail.castShadow = true
        group.add(rail)
      }

      const legGeo = new THREE.BoxGeometry(0.16, 1.0, 1.6)
      const legs = new THREE.InstancedMesh(legGeo, mat('steel'), 20)
      legs.castShadow = true
      const m = new THREE.Matrix4()
      for (let i = 0; i < 20; i++) {
        m.makeTranslation(-len / 2 + 1.5 + i * ((len - 3) / 19), 0.5, 0)
        legs.setMatrixAt(i, m)
      }
      legs.instanceMatrix.needsUpdate = true
      group.add(legs)

      const rollerGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.85, 10)
      rollerGeo.rotateX(Math.PI / 2)
      const rollers = new THREE.InstancedMesh(rollerGeo, mat('steel'), 40)
      const m2 = new THREE.Matrix4()
      for (let i = 0; i < 40; i++) {
        m2.makeTranslation(-len / 2 + 0.8 + i * ((len - 1.6) / 39), 0.94, 0)
        rollers.setMatrixAt(i, m2)
      }
      rollers.instanceMatrix.needsUpdate = true
      group.add(rollers)
    }

    // 传送带上流动的产品：用一个长条 shader plane 模拟，避免 N 个物体
    const flowGeo = new THREE.PlaneGeometry(len, 1.5)
    flowGeo.rotateX(-Math.PI / 2)
    const flowMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x40e0ff) },
        uSpeed: { value: 0.25 + lineIndex * 0.06 },
        uCount: { value: 22 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform float uTime, uSpeed, uCount; uniform vec3 uColor; varying vec2 vUv;
        void main(){
          float t = fract(vUv.x * uCount - uTime * uSpeed);
          float band = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.08, 0.30, t));
          // 只保留带体中间区域，边缘淡出
          float across = 1.0 - smoothstep(0.25, 0.5, abs(vUv.y - 0.5));
          float a = band * across * 0.9;
          if(a < 0.01) discard;
          gl_FragColor = vec4(uColor * 1.8, a);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const flow = new THREE.Mesh(flowGeo, flowMat)
    flow.position.y = 1.16
    // 装饰性特效：不开启拾取层
    group.add(flow)
    this.animated.push((d) => {
      flowMat.uniforms.uTime.value += d
    })

    this.root.add(group)
  }

  /** 单个工位设备：机身 + 控制柜 + 指示灯 + 告警光柱 */
  private buildStation(
    x: number,
    z: number,
    lineIndex: number,
    stationIndex: number,
    rng: () => number,
  ): void {
    const seed = makeDeviceSeed(stationIndex, lineIndex, rng)
    const zOff = stationIndex % 2 === 0 ? -3.2 : 3.2
    const group = new THREE.Group()
    group.position.set(x, 0, z + zOff)
    group.userData.pickId = seed.id
    group.userData.deviceId = seed.id

    // 电控柜：有 glTF 素材时走实例化（18 个柜子只占 5 个 draw call），
    // 否则回退到程序化几何体，直接挂进 LOD 里跟着降精度
    const useCabinetModel = !!this.models?.has('cabinet')
    if (useCabinetModel) {
      const list = this.pendingInstances.get('cabinet') ?? []
      list.push(new THREE.Matrix4().makeTranslation(x + 1.75, 0, z + zOff))
      this.pendingInstances.set('cabinet', list)
      // 记录每个实例归属哪台设备 —— 实例化之后仍能点选的关键
      const owners = this.pendingInstanceOwners.get('cabinet') ?? []
      owners.push(seed.id)
      this.pendingInstanceOwners.set('cabinet', owners)
    }

    // ---- 机身（LOD：三档精度）----
    const lod = new THREE.LOD()

    // 高精度：机身 + 控制柜 + 观察窗 + 散热格栅
    const high = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.0), mat('machine'))
    body.position.y = 1.2
    body.castShadow = true
    body.receiveShadow = true
    high.add(body)

    if (!useCabinetModel) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 1.2), mat('plastic'))
      cabinet.position.set(1.75, 0.9, 0)
      cabinet.castShadow = true
      high.add(cabinet)
    }

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44), mat('glass'))
    screen.position.set(1.755, 1.45, 0)
    screen.rotateY(Math.PI / 2)
    high.add(screen)

    // 散热格栅：细条实例
    const finGeo = new THREE.BoxGeometry(1.6, 0.05, 0.06)
    const fins = new THREE.InstancedMesh(finGeo, mat('plastic'), 8)
    const mf = new THREE.Matrix4()
    for (let i = 0; i < 8; i++) {
      mf.makeTranslation(-0.3, 1.7 + i * 0.07, 1.02)
      fins.setMatrixAt(i, mf)
    }
    fins.instanceMatrix.needsUpdate = true
    high.add(fins)

    // 中精度：只留机身和柜子
    const mid = new THREE.Group()
    const body2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.0), mat('machine'))
    body2.position.y = 1.2
    mid.add(body2)
    if (!useCabinetModel) {
      const cab2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 1.2), mat('plastic'))
      cab2.position.set(1.75, 0.9, 0)
      mid.add(cab2)
    }

    // 低精度：一个盒子
    const low = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 2.2), mat('machine'))
    low.position.y = 1.2

    lod.addLevel(high, 0)
    lod.addLevel(mid, 38)
    lod.addLevel(low, 68)
    group.add(lod)

    // ---- 状态指示灯 ----
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), statusMaterial(seed.status))
    indicator.position.set(1.75, 2.05, 0)
    group.add(indicator)

    // ---- 告警光柱 ----
    const beacon = new AlertBeacon(7.5, 0.5, 0xff4d5e)
    beacon.position.set(0, 0.05, 0)
    beacon.visible = seed.status === 'error'
    group.add(beacon)

    // ---- 机械臂（部分工位）----
    if (stationIndex % 3 === 0) {
      const armFromModel = this.models?.createRobotArm(stationIndex * 1.7)
      if (armFromModel) {
        // 用 glTF 模型：关节按名字取出来，动画才能真正驱动各轴
        armFromModel.root.position.set(-2.0, 0, 0)
        group.add(armFromModel.root)
        this.animated.push((_d, e) => armFromModel.update(e))
      } else {
        // 降级：程序化机械臂
        const arm = new RobotArm()
        arm.group.position.set(-2.0, 0, 0)
        group.add(arm.group)
        this.animated.push((d, e) => arm.update(d, e))
      }
    }

    markPickable(group)
    this.root.add(group)

    const worldPos = new THREE.Vector3(x, 0, z)
    const record: DeviceRecord = {
      ...seed,
      node: group,
      indicator,
      beacon,
      position: worldPos,
    }
    this.devices.push(record)
  }

  // ============================================================ 管廊（流动管线）

  private buildPipeRack(): void {
    const colors = [0x40e0ff, 0x2ee6a8, 0xffb020]
    const zs = [-8, 8]

    zs.forEach((z, i) => {
      const curve = makePipeCurve([
        [-46, 8.4, z],
        [-20, 8.0, z + (i === 0 ? 1.2 : -1.2)],
        [0, 8.6, z],
        [20, 8.0, z + (i === 0 ? -1.2 : 1.2)],
        [46, 8.4, z],
      ])
      const pipe = new FlowPipe({
        curve,
        radius: 0.16,
        color: colors[i % colors.length],
        speed: 0.28 + i * 0.1,
        dashCount: 26,
      })
      pipe.name = `Pipe-${i}`
      this.root.add(pipe)
      this.pipes.push(pipe)
      this.animated.push((d) => pipe.update(d))

      // 竖直下降管 + 弯头（简化为直管段）
      for (const sx of [-24, 0, 24]) {
        const drop = new FlowPipe({
          curve: makePipeCurve([
            [sx, 8.3, z],
            [sx, 5.0, z],
            [sx, 2.2, z + 0.8],
            [sx, 1.6, z + 1.6],
          ]),
          radius: 0.1,
          color: colors[i % colors.length],
          speed: 0.4,
          dashCount: 8,
        })
        this.root.add(drop)
        this.pipes.push(drop)
        this.animated.push((d) => drop.update(d))
      }
    })

    // 支架：实例化
    const bracketGeo = new THREE.BoxGeometry(0.14, 1.2, 0.14)
    const brackets = new THREE.InstancedMesh(bracketGeo, mat('steel'), 24)
    const m = new THREE.Matrix4()
    let k = 0
    for (const z of zs) {
      for (let i = 0; i < 12; i++) {
        m.makeTranslation(-44 + i * 8, 7.6, z)
        brackets.setMatrixAt(k++, m)
      }
    }
    brackets.instanceMatrix.needsUpdate = true
    brackets.castShadow = true
    this.root.add(brackets)
  }

  // ============================================================ 货架（实例化）

  private buildShelves(): void {
    // 货架立柱：InstancedMesh
    const postGeo = new THREE.BoxGeometry(0.14, 6, 0.14)
    const posts = new THREE.InstancedMesh(postGeo, mat('steel'), 4 * 6)
    const m = new THREE.Matrix4()
    let i = 0
    for (let rack = 0; rack < 6; rack++) {
      const rx = -40 + rack * 8
      for (const [ox, oz] of [
        [-1.4, -0.6],
        [1.4, -0.6],
        [-1.4, 0.6],
        [1.4, 0.6],
      ]) {
        m.makeTranslation(rx + ox, 3, -30 + oz)
        posts.setMatrixAt(i++, m)
      }
    }
    posts.instanceMatrix.needsUpdate = true
    posts.castShadow = true
    this.root.add(posts)

    // 货箱：3 层 × 6 架 × 每层 3 箱，共 54 个 → 1 个 drawcall
    const boxGeo = new THREE.BoxGeometry(1.2, 0.9, 1.0)
    const boxes = new THREE.InstancedMesh(boxGeo, mat('plastic'), 54)
    const rng = makeRng(4242)
    const dummy = new THREE.Object3D()
    let n = 0
    for (let rack = 0; rack < 6; rack++) {
      for (let level = 0; level < 3; level++) {
        for (let b = 0; b < 3; b++) {
          dummy.position.set(-40 + rack * 8 + (b - 1) * 1.35, 0.75 + level * 1.7, -30)
          dummy.rotation.y = (rng() - 0.5) * 0.12
          dummy.scale.setScalar(0.9 + rng() * 0.2)
          dummy.updateMatrix()
          boxes.setMatrixAt(n, dummy.matrix)
          // 实例颜色：让货箱有区分度（工业里常用来表示物料批次）
          const c = new THREE.Color().setHSL(0.55 + rng() * 0.12, 0.25, 0.28 + rng() * 0.12)
          boxes.setColorAt(n, c)
          n++
        }
      }
    }
    boxes.instanceMatrix.needsUpdate = true
    if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true
    boxes.castShadow = true
    boxes.receiveShadow = true
    this.root.add(boxes)
  }

  // ============================================================ AGV

  private buildAGV(): void {
    const path = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-38, 0, 8),
        new THREE.Vector3(-12, 0, 8),
        new THREE.Vector3(12, 0, 8),
        new THREE.Vector3(38, 0, 8),
        new THREE.Vector3(38, 0, 22),
        new THREE.Vector3(0, 0, 24),
        new THREE.Vector3(-38, 0, 22),
      ],
      true,
      'catmullrom',
      0.5,
    )

    // 地面导引线
    const guideGeo = new THREE.TubeGeometry(path, 220, 0.045, 6, true)
    const guide = new THREE.Mesh(
      guideGeo,
      new THREE.MeshBasicMaterial({ color: 0x40e0ff, transparent: true, opacity: 0.35 }),
    )
    guide.position.y = 0.03
    this.root.add(guide)

    // AGV 车体：优先 glTF 模型，否则程序化几何体
    const agv = new THREE.Group()
    const agvModel = this.models?.clone('agv')

    if (agvModel) {
      agv.add(agvModel)
    } else {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.1), mat('machine'))
      chassis.position.y = 0.36
      chassis.castShadow = true
      agv.add(chassis)
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.9), mat('plastic'))
      cargo.position.y = 0.83
      cargo.castShadow = true
      agv.add(cargo)
      for (const sx of [-0.5, 0.5]) {
        for (const sz of [-0.42, 0.42]) {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.16, 0.14, 12),
            mat('rubber'),
          )
          wheel.rotateZ(Math.PI / 2)
          wheel.position.set(sx, 0.16, sz)
          agv.add(wheel)
        }
      }
      const agvLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('emissiveOk'))
      agvLight.position.set(0.82, 0.62, 0)
      agv.add(agvLight)
    }

    agv.userData.pickId = 'AGV-01'
    markPickable(agv)
    this.root.add(agv)

    const tmp = new THREE.Vector3()
    const ahead = new THREE.Vector3()
    let t = 0
    this.animated.push((delta) => {
      t = (t + delta * 0.035) % 1
      path.getPointAt(t, tmp)
      agv.position.copy(tmp)
      path.getPointAt((t + 0.004) % 1, ahead)
      // 朝向切线方向，Y 轴对齐
      agv.lookAt(ahead.x, agv.position.y, ahead.z)
    })
  }

  // ============================================================ 安全区围栏

  private buildSafetyZones(): void {
    for (const [x, z] of [
      [-24, -16],
      [4.8, 0],
      [24, 16],
    ]) {
      const fence = new ElectricFence({ width: 7.5, depth: 6.5, height: 2.8, color: 0x40e0ff })
      fence.position.set(x, 0, z)
      this.root.add(fence)
      this.fences.push(fence)
      this.animated.push((d) => fence.update(d))
    }
  }

  // ============================================================ glTF 实例化

  /**
   * 把 buildLines 阶段收集到的变换矩阵一次性实例化。
   *
   * 为什么要"先收集、后统一创建"：
   * InstancedMesh 必须在构造时就确定实例数量，而数量只有在遍历完所有产线后才知道。
   * 这是用实例化构建程序化场景的通用套路。
   */
  private buildInstancedModels(): void {
    if (!this.models) return

    for (const [key, matrices] of this.pendingInstances) {
      const meshes = this.models.instance(key, matrices)
      const owners = this.pendingInstanceOwners.get(key)

      for (const im of meshes) {
        // 让实例化对象也能被点选：把每个实例归属的设备 id 存进 userData，
        // Picker 会按 instanceId 反查（见 Picker.resolve）
        if (owners) im.userData.instancePickIds = owners
        im.layers.enable(1) // 第 1 层 = 可拾取（注意用 enable，不是 set）
        this.root.add(im)
      }

      console.info(
        `[Factory] ${key}: ${matrices.length} 个实例 → ${meshes.length} 个 draw call`,
      )
    }

    this.pendingInstances.clear()
    this.pendingInstanceOwners.clear()
  }

  // ============================================================ 运行时接口

  update(delta: number, elapsed: number): void {
    for (let i = 0; i < this.animated.length; i++) this.animated[i](delta, elapsed)
    this.scanRing.update(delta)
  }

  /** 数据层 → 渲染层的唯一入口：只改材质引用和可见性，不做任何业务判断 */
  applyStatus(device: DeviceRecord, status: DeviceStatus): void {
    device.status = status
    if (device.indicator) {
      device.indicator.material = statusMaterial(status)
    }
    if (device.beacon) {
      device.beacon.visible = status === 'error'
    }
  }

  setFlowEnabled(v: boolean): void {
    for (const p of this.pipes) p.flowEnabled = v
  }

  setFenceAlert(v: boolean): void {
    for (const f of this.fences) f.alert = v
  }

  findDevice(id: string): DeviceRecord | undefined {
    return this.devices.find((d) => d.id === id)
  }

  dispose(): void {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    })
    this.pipes.forEach((p) => p.dispose())
    this.fences.forEach((f) => f.dispose())
    this.scanRing.dispose()
    this.root.clear()
  }
}

// ================================================================ 机械臂

/**
 * 六轴机器人的极简运动学演示。
 * 真实的工业机器人需要正/逆解（IK），这里用手写的关节角驱动 ——
 * 目的是让你理解：动画本质是"随时间改 matrix"，与模型格式无关。
 */
class RobotArm {
  readonly group = new THREE.Group()
  private readonly j1: THREE.Group
  private readonly j2: THREE.Group
  private readonly j3: THREE.Group
  private phase: number

  constructor(phase = Math.random() * Math.PI * 2) {
    this.phase = phase

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.5, 20), mat('steel'))
    base.position.y = 0.25
    base.castShadow = true
    this.group.add(base)

    // J1 回转
    this.j1 = new THREE.Group()
    this.j1.position.y = 0.5
    this.group.add(this.j1)

    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), mat('machine'))
    shoulder.position.y = 0.45
    shoulder.castShadow = true
    this.j1.add(shoulder)

    // J2 大臂俯仰
    this.j2 = new THREE.Group()
    this.j2.position.y = 0.9
    this.j1.add(this.j2)

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.9, 0.34), mat('machine'))
    upper.position.y = 0.95
    upper.castShadow = true
    this.j2.add(upper)

    // J3 小臂俯仰
    this.j3 = new THREE.Group()
    this.j3.position.y = 1.9
    this.j2.add(this.j3)

    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.5, 0.26), mat('machine'))
    fore.position.y = 0.75
    fore.castShadow = true
    this.j3.add(fore)

    // 末端执行器
    const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.42, 12), mat('steel'))
    tool.position.y = 1.62
    this.j3.add(tool)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat('emissiveOk'))
    tip.position.y = 1.86
    this.j3.add(tip)
  }

  update(_delta: number, elapsed: number): void {
    const t = elapsed * 0.85 + this.phase
    // 用不同频率的正弦叠加，避免所有机械臂整齐划一地"做操"
    this.j1.rotation.y = Math.sin(t * 0.5) * 1.15
    this.j2.rotation.x = Math.sin(t * 0.7) * 0.42 - 0.28
    this.j3.rotation.x = Math.sin(t * 0.7 + 1.1) * 0.55 + 0.35
  }
}
