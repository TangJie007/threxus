import * as THREE from 'three'
import { Viewer } from '@/core/Viewer'
import { Resources } from '@/core/Resources'
import { Composer } from '@/core/Composer'
import { Picker } from '@/core/Picker'
import { buildMaterials } from '@/materials/Presets'
import { Environment } from '@/scene/Environment'
import { Factory } from '@/scene/Factory'
import { ModelAssets } from '@/scene/ModelAssets'
import { Labels } from '@/interaction/Labels'
import { CameraRig } from '@/interaction/CameraRig'
import { Dashboard, StatusBar } from '@/ui/Dashboard'
import { createDebug } from '@/ui/Debug'
import { MockTelemetry, type DeviceRecord } from '@/data/devices'
import { ClipController } from '@/fx/ElectricFence'

/**
 * 启动流程分两段，这不是随意拆的 —— 见下面 boot() 的注释。
 */

const canvasHost = document.getElementById('canvas-host') as HTMLDivElement
const labelHost = document.getElementById('label-host') as HTMLDivElement

// 1) 材质：必须最先构建，场景里所有 Mesh 都依赖它
buildMaterials()

// 2) 引擎
const viewer = new Viewer({
  container: canvasHost,
  labelContainer: labelHost,
  stats: true,
  // 场景里有持续动画，所以用连续渲染；
  // 若改造成纯静态看板，把 onDemand 打开可让 GPU 占用直接归零
  onDemand: false,
})

// 3) 资源中心
// DRACO / KTX2 / Meshopt 解码器由 three 0.185 自动打包，无需手动拷贝解码文件
const resources = new Resources({ renderer: viewer.renderer })

// 4) 环境与光照
// 默认使用「程序化环境贴图」（无素材依赖，离线可跑）。
// 放入真实 HDRI 后，把下面的常量改成 'assets/hdri/xxx.hdr' 即可自动切换，
// 加载失败会自动回退到程序化环境，不会白屏。
const HDRI_URL: string | null = null // ← 例如 'assets/hdri/factory_hall_1k.hdr'

const environment = new Environment({
  scene: viewer.scene,
  resources,
  bounds: { width: 100, depth: 70, height: 11 },
})

// 5) 后处理（先用空场景建立管线，内容稍后加进来）
const composer = new Composer(viewer.renderer, viewer.scene, viewer.camera)
viewer.renderOverride = (delta) => composer.render(delta)
viewer.onResize = (w, h) => composer.setSize(w, h)
composer.setSize(canvasHost.clientWidth, canvasHost.clientHeight)

// 6) 相机运镜与状态条（不依赖场景内容，可以立刻建好）
const rig = new CameraRig(viewer.camera, viewer.controls)
const statusBar = new StatusBar(viewer.renderer)

// 7) 立刻启动渲染循环
//
// 关键：渲染循环必须在加载 glTF 之前跑起来。
// 早先的版本在这里用了顶层 await（await ModelAssets.load(...)），结果踩了个大坑：
//   · module script 是 defer 的，顶层 await 会挂住模块的「完成」
//   · 浏览器的 load 事件要等所有 defer script 执行完
//   · load 不触发 → requestAnimationFrame 不被调度 → 整个画面卡死
// 症状极隐蔽：模型全部加载成功、控制台一切正常，但 FPS 永远是 0。
// 正确做法是异步 boot()：模块本身同步跑完，资源在后台加载。
viewer.start()

// ============================================================ 异步装配

let factory: Factory | null = null
let models: ModelAssets | null = null
let picker: Picker | null = null
let labels: Labels | null = null
let dashboard: Dashboard | null = null
let telemetry: MockTelemetry | null = null
let clip: ClipController | null = null
let selectedId: string | null = null

async function boot(): Promise<void> {
  if (HDRI_URL) void environment.useHDRI((url) => resources.loadEnvironment(url), HDRI_URL)

  // glTF 素材：加载失败不抛异常，ModelAssets 内部降级 —— 场景退回全程序化几何体。
  // 工业项目必须这样设计：素材服务挂了不能让整个看板白屏。
  models = await ModelAssets.load(resources)

  // 工厂场景
  factory = new Factory(models)
  viewer.scene.add(factory.root)

  // 剖切：注册需要被剖切的材质（必须在场景建好后，材质才算全集）
  clip = new ClipController()
  clip.register(factory.clippableMaterials)

  // 拾取
  picker = new Picker(viewer.renderer.domElement, viewer.camera, {
    hover: (hit) => {
      const id = (hit?.object.userData.pickId as string | undefined) ?? null
      dashboard?.onHover?.(id)
      document.body.style.cursor = hit ? 'pointer' : 'default'
    },
    click: (hit) => {
      const id = (hit?.object.userData.pickId as string | undefined) ?? null
      if (id) focusDevice(id)
      else clearSelection()
    },
  })
  picker.setTargets([factory.root])

  // 标签
  labels = new Labels(viewer.camera, [factory.root])
  labels.onClick = (d) => focusDevice(d.id)
  for (const d of factory.devices) labels.add(d)

  // 看板
  dashboard = new Dashboard(factory.devices)
  dashboard.onSelect = (id) => focusDevice(id)
  dashboard.onClose = () => clearSelection()
  dashboard.onHover = (id) => {
    // 列表 hover → 3D 描边预览（与点击选中用同一个 OutlinePass）
    if (!selectedId) {
      const d = id ? factory!.findDevice(id) : undefined
      composer.select(d ? [d.node] : [])
    }
  }
  dashboard.updateKPI()

  // 遥测
  telemetry = new MockTelemetry(factory.devices, 900)
  telemetry.onData((patch) => {
    if (!factory) return
    for (const p of patch) {
      const d = factory.findDevice(p.id)
      if (!d) continue
      if (p.metrics) Object.assign(d.metrics, p.metrics)
      dashboard?.updateMetrics(d)
      if (p.status && p.status !== d.status) {
        factory.applyStatus(d, p.status)
        labels?.setStatus(d, p.status)
        dashboard?.updateStatus(d, p.status)
      }
    }
    dashboard?.invalidateKPI()
    viewer.invalidate()
  })
  telemetry.connect()

  // 主循环
  viewer.addUpdater((delta, elapsed) => {
    factory?.update(delta, elapsed)
    rig.update(delta, elapsed)
    picker?.update()
    labels?.update()
    dashboard?.updateKPI()
  })

  // 性能统计必须在渲染之后读：info.reset() 在帧首执行，
  // 放在 updater 里读到的永远是 0（Three.js 后处理管线的经典陷阱）
  viewer.onAfterUpdate = (delta) => {
    statusBar.update(delta, viewer.fps)
  }

  // 漫游模式下禁用拾取，避免相机和射线抢事件
  viewer.onBeforeUpdate = () => {
    if (picker) picker.enabled = !rig.busy
  }

  wireToolbar()
  createDebug({
    viewer,
    composer,
    factory,
    environment,
    rig,
    labels,
    onSnapshot: () => viewer.snapshot(`factory-twin-${Date.now()}.png`),
  })

  // 暴露到 window 方便在 Console 里直接调参试验
  Object.assign(window as unknown as Record<string, unknown>, {
    __twin: {
      viewer,
      factory,
      composer,
      rig,
      resources,
      models,
      devices: factory.devices,
      focusDevice,
    },
  })

  console.info(
    '%c[FactoryTwin] 已启动',
    'color:#40e0ff;font-weight:bold',
    '\n· 控制台可用 __twin 访问所有模块',
    '\n· 快捷键：Esc 取消选中 / R 切换巡检 / P 截图',
    `\n· 设备数：${factory.devices.length}`,
    `\n· glTF 素材：${models.loadedKeys.length}/4`,
  )

  hideLoading()
}

// ============================================================ 选中逻辑

function focusDevice(id: string): void {
  if (!factory) return
  const d = factory.findDevice(id)
  if (!d) {
    // AGV 这类非设备对象
    if (id === 'AGV-01') {
      const node = factory.root.getObjectByProperty('userData.pickId', id)
      if (node) rig.flyTo(node.getWorldPosition(new THREE.Vector3()), 10, 6)
    }
    return
  }
  selectedId = id
  composer.select([d.node])
  dashboard?.select(id)
  // 相机飞过去：站在设备斜上方，保留当前方位角
  rig.flyTo(d.position.clone().setY(1.6), 11, 7)
  // 扫描圈聚焦到该设备，形成"定位"反馈
  factory.scanRing.focusAt(d.position.x, d.position.z)
  viewer.invalidate()
}

function clearSelection(): void {
  selectedId = null
  composer.select([])
  dashboard?.select(null)
  viewer.invalidate()
}

// ============================================================ 工具条

function wireToolbar(): void {
  const toolbar = document.getElementById('toolbar') as HTMLDivElement
  if (!toolbar || !factory || !labels || !clip) return

  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!btn) return

    if (btn.dataset.mode) {
      const mode = btn.dataset.mode as 'orbit' | 'roam'
      rig.setMode(mode)
      toolbar.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
        b.classList.toggle('on', b === btn)
      })
      return
    }

    const key = btn.dataset.toggle as string
    if (!key) return
    const next = !btn.classList.contains('on')
    btn.classList.toggle('on', next)

    switch (key) {
      case 'outline':
        composer.setEnabled('outline', next)
        break
      case 'bloom':
        composer.setEnabled('bloom', next)
        break
      case 'ao':
        composer.setEnabled('ao', next)
        break
      case 'flow':
        factory!.setFlowEnabled(next)
        break
      case 'fence':
        factory!.setFenceAlert(next) // 工具条上的"围栏"= 告警态切换
        break
      case 'clip':
        clip!.setEnabled(next)
        break
      case 'labels':
        labels!.setVisible(next)
        break
    }
    viewer.invalidate()
  })
}

// ============================================================ 收尾

function hideLoading(): void {
  const loading = document.getElementById('loading')
  if (!loading) return
  loading.classList.add('hide')
  setTimeout(() => loading.remove(), 600)
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') clearSelection()
  if (e.key === 'r' || e.key === 'R') rig.setMode(rig.mode === 'roam' ? 'orbit' : 'roam')
  if (e.key === 'p' || e.key === 'P') viewer.snapshot()
})

// 热更新 / 页面卸载时释放 —— 少了这一步，Vite HMR 几十次后必崩
if (import.meta.hot) {
  import.meta.hot.dispose(() => teardown())
}
window.addEventListener('beforeunload', teardown)

function teardown(): void {
  telemetry?.disconnect()
  picker?.dispose()
  labels?.dispose()
  composer.dispose()
  factory?.dispose()
  models?.dispose() // glTF 模板的 geometry/material 被所有实例共享，顺序要在 factory 之后
  environment.dispose()
  resources.dispose()
  viewer.dispose()
}

// 启动异步装配。注意：不能在这里 await —— 那会退化成顶层 await，
// 把 load 事件和渲染循环一起挂死。
boot().catch((err) => {
  console.error('[FactoryTwin] 启动失败', err)
  hideLoading()
})

export type { DeviceRecord }
