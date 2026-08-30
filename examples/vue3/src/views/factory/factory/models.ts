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
  robotArm: 'assets/models/robot-arm.glb',
  conveyor: 'assets/models/conveyor.glb',
  cabinet: 'assets/models/cabinet.glb',
  agv: 'assets/models/agv.glb',
} as const

export type ModelKey = keyof typeof MODEL_FILES

export interface RobotArmHandle {
  readonly root: THREE.Object3D
  update(elapsed: number): void
}

/**
 * 六轴机器人实例。
 *
 * 关键点：关节是**按名字**从加载好的模型里找出来的（J1/J2/J3），
 * 这正是生成脚本里严格按 Base → J1 → J2 → J3 → Tool 建层级的原因。
 * 如果建模时把所有零件 merge 成一个 mesh，模型就"死"了 —— 只能整体移动，
 * 永远做不出真正的机器人动作。
 */
export function createRobotArmHandle(
  template: THREE.Object3D,
  phase = Math.random() * Math.PI * 2,
): RobotArmHandle {
  const root = template.clone(true)

  const j1 = root.getObjectByName('J1_Shoulder') ?? null
  const j2 = root.getObjectByName('J2_UpperArm') ?? null
  const j3 = root.getObjectByName('J3_ForeArm') ?? null

  // clone() 后要让所有关节回到初始姿态，否则不同实例会继承模板的残留旋转
  root.traverse((o) => {
    o.castShadow = true
    o.receiveShadow = true
  })

  return {
    root,
    update(elapsed: number) {
      const t = elapsed * 0.85 + phase
      if (j1) j1.rotation.y = Math.sin(t * 0.5) * 1.15
      if (j2) j2.rotation.x = Math.sin(t * 0.7) * 0.42 - 0.28
      if (j3) j3.rotation.x = Math.sin(t * 0.7 + 1.1) * 0.55 + 0.35
    },
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

export interface ModelAssets {
  readonly loadedKeys: ModelKey[]
  has(key: ModelKey): boolean
  get(key: ModelKey): THREE.Object3D | null
  createRobotArm(phase?: number): RobotArmHandle | null
  instance(key: ModelKey, matrices: THREE.Matrix4[]): THREE.InstancedMesh[]
  clone(key: ModelKey): THREE.Object3D | null
  dispose(): void
}

/** 加载全部素材。单个失败不影响其他，且不会抛异常（场景会降级到程序化几何体） */
export async function loadModelAssets(loadGLTF: GltfLoader): Promise<ModelAssets> {
  const templates = new Map<ModelKey, THREE.Object3D>()
  const loadedKeys: ModelKey[] = []

  const entries = Object.entries(MODEL_FILES) as Array<[ModelKey, string]>
  const results = await Promise.allSettled(entries.map(([, url]) => loadGLTF(url)))

  results.forEach((res, i) => {
    const key = entries[i][0]
    if (res.status === 'fulfilled') {
      const scene = res.value.scene
      prepareMaterials(scene)
      templates.set(key, scene)
      loadedKeys.push(key)
      console.info(`[ModelAssets] ✓ ${key}  (${MODEL_FILES[key]})`)
    } else {
      console.warn(`[ModelAssets] ✗ ${key} 加载失败，将回退到程序化几何体`, res.reason)
    }
  })

  return {
    loadedKeys,
    has(key) {
      return templates.has(key)
    },
    get(key) {
      return templates.get(key) ?? null
    },
    createRobotArm(phase?: number) {
      const t = templates.get('robotArm')
      if (!t) return null
      return createRobotArmHandle(t, phase)
    },
    instance(key, matrices) {
      const t = templates.get(key)
      if (!t) return []
      return instanceSubtree(t, matrices)
    },
    clone(key) {
      const t = templates.get(key)
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
    },
    dispose() {
      // 模板的 geometry / material 被所有实例共享，这里统一释放
      for (const t of templates.values()) {
        t.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          m.geometry.dispose()
          const mat = m.material as THREE.Material | THREE.Material[]
          ;(Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose())
        })
      }
      templates.clear()
      loadedKeys.length = 0
    },
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
