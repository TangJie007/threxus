import * as THREE from 'three'
/**
 * glTF 素材管理。
 *
 * 这个文件演示的是「拿到外部模型之后该做什么」—— 大多数教程讲完
 * `loader.load()` 就结束了，但真实项目里加载只是第一步，之后还有四件事：
 *
 *  1. 预处理材质：glTF 里的自发光材质默认被 tone mapping 压住，Bloom 提不出来
 *  2. 按实例复用：18 个电控柜如果各自 clone，就是 90 个 draw call，
 *     必须把模型的每个 mesh 抽出来重新实例化（见 instanceSubtree）
 *  3. 关节查找：工业机器人模型必须按关节拆节点，运行时按名字取出来做动画
 *  4. 降级兜底：模型加载失败不能让整个场景白屏，要能回退到程序化几何体
 */

const MODEL_FILES = {
  robotArm: '/assets/models/robot-arm.glb',
  conveyor: '/assets/models/conveyor.glb',
  cabinet: '/assets/models/cabinet.glb',
  agv: '/assets/models/agv.glb',
} as const

export type ModelKey = keyof typeof MODEL_FILES

/**
 * 六轴机器人实例。
 *
 * 关键点：关节是**按名字**从加载好的模型里找出来的（J1/J2/J3），
 * 这正是生成脚本里严格按 Base → J1 → J2 → J3 → Tool 建层级的原因。
 * 如果建模时把所有零件 merge 成一个 mesh，模型就"死"了 —— 只能整体移动，
 * 永远做不出真正的机器人动作。
 */
export class RobotArmInstance {
  readonly root: THREE.Object3D
  private readonly j1: THREE.Object3D | null
  private readonly j2: THREE.Object3D | null
  private readonly j3: THREE.Object3D | null
  private readonly phase: number

  constructor(template: THREE.Object3D, phase = Math.random() * Math.PI * 2) {
    this.root = template.clone(true)
    this.phase = phase

    this.j1 = this.root.getObjectByName('J1_Shoulder') ?? null
    this.j2 = this.root.getObjectByName('J2_UpperArm') ?? null
    this.j3 = this.root.getObjectByName('J3_ForeArm') ?? null

    // clone() 后要让所有关节回到初始姿态，否则不同实例会继承模板的残留旋转
    this.root.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
  }

  update(elapsed: number): void {
    const t = elapsed * 0.85 + this.phase
    if (this.j1) this.j1.rotation.y = Math.sin(t * 0.5) * 1.15
    if (this.j2) this.j2.rotation.x = Math.sin(t * 0.7) * 0.42 - 0.28
    if (this.j3) this.j3.rotation.x = Math.sin(t * 0.7 + 1.1) * 0.55 + 0.35
  }
}

/**
 * 把一棵模板子树「炸开」成若干个 InstancedMesh。
 *
 * 为什么需要这个：
 * 一个电控柜 glb 里有 5 个 mesh（柜体/门/玻璃/格栅/指示灯）。
 * 要在场景里摆 18 个柜子：
 *   · 直接 clone 18 份  → 18 × 5 = 90 个 draw call
 *   · 用本函数实例化    → 5 个 draw call（每个 mesh 一个 InstancedMesh）
 *
 * 这是 glTF 素材能否用于大场景的分水岭。
 *
 * @param template 模板根节点（其自身变换应为单位矩阵）
 * @param matrices 每个实例的放置矩阵
 */
export function instanceSubtree(
  template: THREE.Object3D,
  matrices: THREE.Matrix4[],
): THREE.InstancedMesh[] {
  if (matrices.length === 0) return []

  // 必须先刷新世界矩阵，才能拿到子 mesh 相对根节点的正确变换
  template.updateWorldMatrix(true, true)

  const result: THREE.InstancedMesh[] = []
  const base = new THREE.Matrix4()
  const composed = new THREE.Matrix4()

  template.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    const im = new THREE.InstancedMesh(
      mesh.geometry,
      mesh.material as THREE.Material,
      matrices.length,
    )
    im.name = `${mesh.name}_instanced`
    im.castShadow = true
    im.receiveShadow = true

    // 该 mesh 相对模板根节点的位置
    base.copy(mesh.matrixWorld)

    for (let i = 0; i < matrices.length; i++) {
      composed.multiplyMatrices(matrices[i], base)
      im.setMatrixAt(i, composed)
    }
    im.instanceMatrix.needsUpdate = true
    result.push(im)
  })

  return result
}

export type GltfLoader = (url: string) => Promise<{ scene: THREE.Object3D }>

export class ModelAssets {
  private readonly templates = new Map<ModelKey, THREE.Object3D>()
  readonly loadedKeys: ModelKey[] = []

  private constructor() {}

  /** 加载全部素材。单个失败不影响其他，且不会抛异常（场景会降级到程序化几何体） */
  static async load(loadGLTF: GltfLoader): Promise<ModelAssets> {
    const assets = new ModelAssets()

    const entries = Object.entries(MODEL_FILES) as Array<[ModelKey, string]>
    const results = await Promise.allSettled(entries.map(([, url]) => loadGLTF(url)))

    results.forEach((res, i) => {
      const key = entries[i][0]
      if (res.status === 'fulfilled') {
        const scene = res.value.scene
        prepareMaterials(scene)
        assets.templates.set(key, scene)
        assets.loadedKeys.push(key)
        console.info(`[ModelAssets] ✓ ${key}  (${MODEL_FILES[key]})`)
      } else {
        console.warn(`[ModelAssets] ✗ ${key} 加载失败，将回退到程序化几何体`, res.reason)
      }
    })

    return assets
  }

  has(key: ModelKey): boolean {
    return this.templates.has(key)
  }

  get(key: ModelKey): THREE.Object3D | null {
    return this.templates.get(key) ?? null
  }

  /** 创建一个带关节动画的机械臂实例 */
  createRobotArm(phase?: number): RobotArmInstance | null {
    const t = this.templates.get('robotArm')
    if (!t) return null
    return new RobotArmInstance(t, phase)
  }

  /** 把一个模型实例化 N 份 */
  instance(key: ModelKey, matrices: THREE.Matrix4[]): THREE.InstancedMesh[] {
    const t = this.templates.get(key)
    if (!t) return []
    return instanceSubtree(t, matrices)
  }

  /** 创建一个单次使用的克隆（AGV 这种只有一个的物件） */
  clone(key: ModelKey): THREE.Object3D | null {
    const t = this.templates.get(key)
    if (!t) return null
    const c = t.clone(true)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return c
  }

  dispose(): void {
    // 模板的 geometry / material 被所有实例共享，这里统一释放
    for (const t of this.templates.values()) {
      t.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[]
        ;(Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose())
      })
    }
    this.templates.clear()
    this.loadedKeys.length = 0
  }
}

/**
 * 材质预处理。
 *
 * glTF 导出的自发光材质，其 emissive 值被 three 读进来后仍会走 tone mapping，
 * 亮度被压在 1.0 以内 —— 结果就是 Bloom 完全提不出高光，指示灯不发光。
 * 这里遍历一遍，把自发光材质挑出来关掉 toneMapped 并增强强度。
 */
function prepareMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (!mat || !mat.emissive) return

    const isEmissive = mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.01
    if (isEmissive) {
      // 克隆一份再改 —— 直接改会影响所有共用该材质的实例
      mat.toneMapped = false
      mat.emissiveIntensity = 2.4
    }
  })
}
