import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import Stats from 'stats.js'

export type Updater = (delta: number, elapsed: number) => void

export interface ViewerOptions {
  container: HTMLElement
  labelContainer: HTMLElement
  /** 按需渲染：画面无变化时不绘制，工业看板场景可省 80%+ GPU */
  onDemand?: boolean
  shadows?: boolean
  stats?: boolean
  maxPixelRatio?: number
}

/**
 * 引擎主类。工业级项目的第一条纪律：
 * 渲染器 / 场景 / 相机 / 循环 / 尺寸 / 销毁 全部收敛到一处，禁止散落在业务代码里。
 */
export class Viewer {
  readonly container: HTMLElement
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  readonly labelRenderer: CSS2DRenderer
  /** r185 起 Clock 已废弃，Timer 支持 Page Visibility，切后台回来不会暴涨 delta */
  readonly timer = new THREE.Timer()

  onDemand: boolean
  readonly stats?: Stats

  private readonly updaters: Updater[] = []
  private readonly disposers: Array<() => void> = []
  private rafId = 0
  private elapsed = 0
  private dirty = true
  private running = false

  /** 帧率统计（自己算，不依赖 stats.js） */
  private frames = 0
  private fpsTime = 0
  fps = 0

  constructor(opts: ViewerOptions) {
    this.container = opts.container
    this.onDemand = opts.onDemand ?? false

    // ---------- Renderer ----------
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // 保留 drawingBuffer 便于截图导出；纯看板场景可关掉省显存
      preserveDrawingBuffer: true,
      stencil: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2))
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)

    // 色彩管理：r152 之后必须显式声明，否则 PBR 会整体偏灰
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // 工业场景光比大，ACES 是唯一能同时保住高光和暗部的曲线
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    // 渲染统计手动接管（见下面 info.autoReset 的说明）
    this.renderer.info.autoReset = false

    if (opts.shadows ?? true) {
      this.renderer.shadowMap.enabled = true
      // r185 起 PCFSoftShadowMap 已废弃，统一用 PCFShadowMap
      this.renderer.shadowMap.type = THREE.PCFShadowMap
      // 剖切（ClippingPlanes）需要显式开启
      this.renderer.localClippingEnabled = true
    }

    this.container.appendChild(this.renderer.domElement)

    // ---------- Scene / Camera ----------
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0f16)
    // 距离雾：给大场景加空气透视，同时天然遮住远处 LOD 切换
    this.scene.fog = new THREE.Fog(0x0a0f16, 60, 190)

    const { clientWidth: w, clientHeight: h } = this.container
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 800)
    this.camera.position.set(34, 24, 40)

    // ---------- Controls ----------
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.target.set(0, 3, 0)
    this.controls.maxPolarAngle = Math.PI * 0.495 // 不允许钻到地面以下
    this.controls.minDistance = 6
    this.controls.maxDistance = 140
    this.controls.screenSpacePanning = false
    // 工业场景的通用操作习惯：左键旋转、中键缩放、右键平移
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
    this.controls.addEventListener('change', () => this.invalidate())

    // ---------- CSS2D ----------
    this.labelRenderer = new CSS2DRenderer({ element: opts.labelContainer as HTMLDivElement })
    this.labelRenderer.setSize(w, h)

    // ---------- Stats ----------
    if (opts.stats) {
      this.stats = new Stats()
      this.stats.dom.style.cssText = 'position:absolute;top:60px;right:14px;z-index:20;opacity:.85'
      this.container.appendChild(this.stats.dom)
    }

    // ---------- 事件 ----------
    this._onResize = this._onResize.bind(this)
    this._tick = this._tick.bind(this)
    const ro = new ResizeObserver(this._onResize)
    ro.observe(this.container)
    this.disposers.push(() => ro.disconnect())

    window.addEventListener('webglcontextlost', this._onContextLost as EventListener)
    this.disposers.push(() =>
      window.removeEventListener('webglcontextlost', this._onContextLost as EventListener),
    )
  }

  // ============ 生命周期 ============

  start(): void {
    if (this.running) return
    this.running = true
    this.timer.connect(document) // 启用 Page Visibility 保护
    this.rafId = requestAnimationFrame(this._tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  /** 注册每帧回调，返回注销函数 */
  addUpdater(fn: Updater): () => void {
    this.updaters.push(fn)
    return () => {
      const i = this.updaters.indexOf(fn)
      if (i > -1) this.updaters.splice(i, 1)
    }
  }

  /** 按需渲染模式下，任何改变画面的操作后都要调用它 */
  invalidate(): void {
    this.dirty = true
  }

  private _onContextLost = (e: Event) => {
    // 工业看板 7x24 常亮，上下文丢失（显卡驱动重置/休眠）必须能自愈
    e.preventDefault()
    console.warn('[Viewer] WebGL context lost, stopping loop.')
    this.stop()
  }

  private _onResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.labelRenderer.setSize(w, h)
    this.onResize?.(w, h)
    this.invalidate()
  }

  /** 子类/外部可挂载的 resize 钩子（后处理、拾取缓冲都要跟着改尺寸） */
  onResize?: (w: number, h: number) => void

  private _tick(): void {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this._tick)

    // 每帧开头清空统计 —— 这样 info 累计的是「整帧所有 pass」的真实开销。
    // 默认的 autoReset 会在每次 renderer.render() 时清零，
    // 用了 EffectComposer 后最后一个 pass 是全屏三角形，
    // 结果 Draw Call 永远显示 1，完全失去监控意义。
    this.renderer.info.reset()

    // Timer 内部用 Page Visibility API，切后台回来 delta 不会暴涨
    this.timer.update()
    const delta = Math.min(this.timer.getDelta(), 0.1)
    this.elapsed += delta

    this.stats?.begin()
    this.onBeforeUpdate?.(delta, this.elapsed)

    for (let i = 0; i < this.updaters.length; i++) this.updaters[i](delta, this.elapsed)
    this.controls.update()

    if (!this.onDemand || this.dirty) {
      if (this.renderOverride) this.renderOverride(delta)
      else this.renderer.render(this.scene, this.camera)
      this.labelRenderer.render(this.scene, this.camera)
      this.dirty = false
    }

    // FPS
    this.frames++
    this.fpsTime += delta
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTime)
      this.frames = 0
      this.fpsTime = 0
    }

    // 渲染后钩子：性能统计必须在这里读。
    // info.reset() 在帧首执行，渲染前读到的一定是 0。
    this.onAfterUpdate?.(delta, this.elapsed)

    this.stats?.end()
  }

  onBeforeUpdate?: (delta: number, elapsed: number) => void
  /** 渲染完成后触发。renderer.info 的统计只有在这里才是完整的 */
  onAfterUpdate?: (delta: number, elapsed: number) => void

  /**
   * 外部渲染接管（后处理管线用）。
   * 注意 CSS2D 标签依然由 Viewer 负责渲染 —— 它走的是 DOM，与 WebGL 管线无关。
   */
  renderOverride: ((delta: number) => void) | null = null

  render(): void {
    if (this.renderOverride) this.renderOverride(0)
    else this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  /** 导出当前画面为 PNG（工业项目常见需求：截图留证 / 生成巡检报告） */
  snapshot(filename = 'twin.png'): void {
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  // ============ 销毁 ============

  /**
   * 完整释放。Three.js 不会自动回收 GPU 资源，
   * SPA 路由切换时不 dispose 必然内存泄漏 —— 这是工业项目最常见的线上事故。
   */
  dispose(): void {
    this.stop()
    this.timer.disconnect()
    this.controls.dispose()

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      // 几何体：可能有多个 mesh 共用，用 Set 去重
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (!mat) return
      const list = Array.isArray(mat) ? mat : [mat]
      for (const m of list) {
        // 释放材质上挂的所有贴图
        for (const value of Object.values(m)) {
          if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose()
        }
        m.dispose()
      }
    })
    this.scene.clear()

    for (const fn of this.disposers) fn()
    this.disposers.length = 0

    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    this.labelRenderer.domElement.remove()
    this.stats?.dom.remove()
  }
}
