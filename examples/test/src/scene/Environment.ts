import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export interface EnvironmentOptions {
  scene: THREE.Scene
  resources: { environmentFromScene(s: THREE.Scene, sigma?: number): THREE.Texture }
  /** 厂区尺寸，用于计算阴影相机范围 —— 阴影相机的紧致程度直接决定阴影质量 */
  bounds: { width: number; depth: number; height: number }
  hdriUrl?: string
}

/**
 * 程序化工业环境：一个带顶部灯带的房间，用 PMREM 烘成环境贴图。
 *
 * 这是"没网也能出高级感"的核心技巧：
 * PBR 金属的观感 90% 来自环境反射，而不是直接光。
 * 顶部灯带会在设备曲面上拉出长条形高光 —— 这正是真实厂房里的视觉特征。
 * RoomEnvironment 是通用室内，勉强能用，但灯带版本明显更"工厂"。
 */
function buildFactoryEnvScene(): THREE.Scene {
  const s = new THREE.Scene()
  s.background = new THREE.Color(0x1a2129)

  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.deleteAttribute('uv')

  // 房间外壳（内表面）
  const shell = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x2a323c }),
  )
  shell.scale.set(32, 16, 32)
  shell.position.y = 6
  s.add(shell)

  // 地面偏暗
  const floor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x14181d }))
  floor.scale.set(30, 0.2, 30)
  floor.position.y = -1.9
  s.add(floor)

  // 顶部灯带：4 条冷白灯管，提供最主要的高光形状
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const lampGeo = new THREE.BoxGeometry(1, 1, 1)
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j += 2) {
      const lamp = new THREE.Mesh(lampGeo, lampMat)
      lamp.scale.set(13, 0.5, 0.9)
      lamp.position.set(j * 5.5, 13.2, i * 8)
      s.add(lamp)
    }
  }

  // 侧面暖色补光：模拟安全出口指示灯 / 焊接工位的环境色
  const warm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff9a4d }))
  warm.scale.set(0.4, 5, 22)
  warm.position.set(-14.5, 4, 0)
  s.add(warm)

  const cool = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x4da6ff }))
  cool.scale.set(0.4, 5, 22)
  cool.position.set(14.5, 4, 0)
  s.add(cool)

  return s
}

export class Environment {
  readonly hemi: THREE.HemisphereLight
  readonly sun: THREE.DirectionalLight
  readonly fill: THREE.DirectionalLight
  envMap: THREE.Texture | null = null

  constructor(private readonly opts: EnvironmentOptions) {
    const { scene, bounds } = opts

    // ---------- 环境贴图 ----------
    const envScene = buildFactoryEnvScene()
    this.envMap = opts.resources.environmentFromScene(envScene, 0.035)
    scene.environment = this.envMap
    // environmentIntensity 是 r163+ 的新属性，比逐个材质调 envMapIntensity 方便
    scene.environmentIntensity = 0.85
    // 背景不用环境贴图（太亮太糊），用纯色 + 雾更有工业感
    disposeScene(envScene)

    // ---------- 灯光 ----------
    // 半球光：用极低强度打底，防止背光面死黑
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x1a1f26, 0.35)
    scene.add(this.hemi)

    // 主光：模拟顶部采光，唯一投影的灯 —— 阴影很贵，只留一盏
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6)
    this.sun.position.set(28, 42, 22)
    this.sun.castShadow = true

    const r = Math.max(bounds.width, bounds.depth) * 0.62
    const cam = this.sun.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 140
    cam.updateProjectionMatrix()

    this.sun.shadow.mapSize.set(2048, 2048)
    // bias 调不好会出现 peter-panning（阴影脱离物体）或 shadow acne（自阴影条纹）
    // 工业场景的经验值：bias 极小 + normalBias 按物体尺度给
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.035
    scene.add(this.sun)
    scene.add(this.sun.target)

    // 补光：不投影，只压暗部
    this.fill = new THREE.DirectionalLight(0x87b4ff, 0.28)
    this.fill.position.set(-24, 16, -20)
    scene.add(this.fill)
  }

  /** 有真实 HDRI 时替换掉程序化环境（质量更高） */
  async useHDRI(loader: (url: string) => Promise<THREE.Texture>, url: string): Promise<boolean> {
    try {
      const tex = await loader(url)
      this.opts.scene.environment = tex
      this.envMap?.dispose()
      this.envMap = tex
      return true
    } catch (e) {
      console.warn('[Environment] HDRI 加载失败，沿用程序化环境', e)
      return false
    }
  }

  dispose(): void {
    this.envMap?.dispose()
    this.hemi.dispose()
    this.sun.dispose()
    this.fill.dispose()
  }
}

function disposeScene(s: THREE.Scene): void {
  s.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose())
  })
  s.clear()
}

export { RoomEnvironment }
