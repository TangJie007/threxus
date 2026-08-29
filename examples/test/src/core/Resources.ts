import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
// r185 起 RGBELoader 已废弃，官方重命名为 HDRLoader（格式仍是 RGBE/.hdr）
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

type ProgressFn = (loaded: number, total: number, url: string) => void

export interface ResourcesOptions {
  renderer: THREE.WebGLRenderer
  /**
   * DRACO 解码器目录。**通常不需要设置** ——
   * three r180+ 已通过 `new URL('../libs/draco/...', import.meta.url)` 内置解码器路径，
   * 打包器会自动把 wasm/js 打进产物（见 dist/assets/draco_*）。
   * 只有在需要走内网 CDN 或自定义路径时才传这个值。
   */
  dracoPath?: string
  /** KTX2/Basis 转码器目录，同上，一般留空 */
  ktx2Path?: string
}

/**
 * 统一资源中心。三个工业级要点：
 * 1. 单一 LoadingManager —— 全局进度条、失败兜底、并发控制都在这一层
 * 2. URL 级缓存     —— 同一个模型在场景里用 100 次，只下载和解析一次
 * 3. 集中 dispose   —— 谁申请谁释放容易漏，注册到这儿统一回收
 */
export class Resources {
  readonly manager: THREE.LoadingManager
  readonly gltf: GLTFLoader
  readonly ktx2?: KTX2Loader
  readonly textureLoader = new THREE.TextureLoader()
  readonly hdrLoader = new HDRLoader()

  private readonly cache = new Map<string, unknown>()
  private readonly pmrem: THREE.PMREMGenerator

  constructor(private readonly opts: ResourcesOptions) {
    this.manager = new THREE.LoadingManager()
    this.pmrem = new THREE.PMREMGenerator(opts.renderer)
    this.pmrem.compileEquirectangularShader()

    // ---- DRACO：几何压缩，工业模型动辄 50MB+，不开 DRACO 基本没法上线 ----
    // 不调用 setDecoderPath 时，three 会用内置的（随包构建的）解码器
    const draco = new DRACOLoader(this.manager)
    if (opts.dracoPath) draco.setDecoderPath(opts.dracoPath)
    this.gltf = new GLTFLoader(this.manager).setDRACOLoader(draco)
    this.disposers.push(() => draco.dispose())

    // ---- KTX2：GPU 压缩纹理，显存占用只有 PNG 的 1/4~1/6 ----
    try {
      const ktx2 = new KTX2Loader(this.manager).detectSupport(opts.renderer)
      if (opts.ktx2Path) ktx2.setTranscoderPath(opts.ktx2Path)
      this.gltf.setKTX2Loader(ktx2)
      this.ktx2 = ktx2
      this.disposers.push(() => ktx2.dispose())
    } catch (e) {
      console.warn('[Resources] KTX2 不可用，将回退到未压缩纹理', e)
    }

    // ---- Meshopt：比 DRACO 解压快 10 倍，适合运行时流式加载 ----
    this.gltf.setMeshoptDecoder(MeshoptDecoder)

    // ---- 纹理色彩空间 ----
    this.textureLoader.setPath('')
  }

  private readonly disposers: Array<() => void> = []

  onProgress(fn: ProgressFn): void {
    this.manager.onProgress = (url, loaded, total) => fn(loaded, total, url)
  }

  onLoad(fn: () => void): void {
    this.manager.onLoad = fn
  }

  onError(fn: (url: string) => void): void {
    this.manager.onError = fn
  }

  // ============ 加载接口（全部带缓存） ============

  async loadGLTF(url: string): Promise<GLTF> {
    return this.cached(url, () => this.gltf.loadAsync(url))
  }

  async loadTexture(url: string, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
    return this.cached(url, async () => {
      const tex = await this.textureLoader.loadAsync(url)
      // 颜色贴图用 sRGB，法线/粗糙度/AO/金属度必须 Linear，搞错整个 PBR 就废了
      tex.colorSpace = colorSpace
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.anisotropy = Math.min(8, this.opts.renderer.capabilities.getMaxAnisotropy())
      tex.generateMipmaps = true
      tex.needsUpdate = true
      return tex
    })
  }

  /** 加载 HDR 环境贴图 → PMREM 预卷积，PBR 金属件的"高级感"全靠它 */
  async loadEnvironment(url: string): Promise<THREE.Texture> {
    return this.cached(`env:${url}`, async () => {
      const hdr = await this.hdrLoader.loadAsync(url)
      hdr.mapping = THREE.EquirectangularReflectionMapping
      const envMap = this.pmrem.fromEquirectangular(hdr).texture
      hdr.dispose()
      return envMap
    })
  }

  /** 用程序化 Scene 生成环境贴图（无网络 / 无 HDRI 文件时的兜底方案） */
  environmentFromScene(scene: THREE.Scene, sigma = 0.04): THREE.Texture {
    return this.pmrem.fromScene(scene, sigma).texture
  }

  private async cached<T>(key: string, factory: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) return this.cache.get(key) as T
    const p = factory()
    this.cache.set(key, p)
    try {
      const v = await p
      this.cache.set(key, v)
      return v
    } catch (e) {
      this.cache.delete(key) // 失败不能留脏缓存，否则重试永远拿不到
      throw e
    }
  }

  dispose(): void {
    for (const v of this.cache.values()) {
      if (v && typeof v === 'object') {
        if ((v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
        if ((v as { scene?: THREE.Object3D }).scene) disposeObject3D((v as GLTF).scene)
      }
    }
    this.cache.clear()
    for (const fn of this.disposers) fn()
    this.disposers.length = 0
    this.pmrem.dispose()
  }
}

/**
 * 递归释放一棵子树的 GPU 资源。
 * 注意：共享的 geometry / material / texture 会被多个 mesh 引用，
 * 这里用 Set 去重，避免 dispose 两次（第二次是 no-op，但会掩盖真实泄漏）。
 */
export function disposeObject3D(root: THREE.Object3D): void {
  const geos = new Set<THREE.BufferGeometry>()
  const mats = new Set<THREE.Material>()
  const texs = new Set<THREE.Texture>()

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh & { material?: THREE.Material | THREE.Material[] }
    if (mesh.geometry) geos.add(mesh.geometry)
    const m = mesh.material
    if (!m) return
    for (const mat of Array.isArray(m) ? m : [m]) {
      mats.add(mat)
      for (const v of Object.values(mat)) {
        if (v && (v as THREE.Texture).isTexture) texs.add(v as THREE.Texture)
      }
    }
  })

  geos.forEach((g) => g.dispose())
  mats.forEach((m) => m.dispose())
  texs.forEach((t) => t.dispose())
  root.removeFromParent()
}
