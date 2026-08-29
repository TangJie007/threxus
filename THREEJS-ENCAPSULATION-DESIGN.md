# Three.js 轻量运行时封装设计方案

## 1. 文档目标

本文档描述一个面向中大型 Three.js 应用的封装方案。

封装的目标不是重新实现 Three.js，也不是使用自定义类型替代 `Scene`、`Mesh`、`Material` 等原生对象，而是集中解决以下工程问题：

- 应用初始化代码重复。
- 渲染循环、窗口尺寸变化和销毁流程分散。
- 场景功能之间缺少清晰边界。
- 模型、纹理、材质和几何体的所有权不明确。
- 事件监听、逐帧回调和异步任务容易泄漏。
- 模块之间依赖全局变量或相互直接引用。
- 业务规模扩大后，代码难以拆分、测试和复用。
- 简单场景需要编写大量样板代码。

本方案将封装定位为：

> 面向功能与生命周期的 Three.js 轻量运行时。

核心架构由以下思想组成：

- 微内核与插件架构。
- Feature-first / Vertical Slice。
- 控制反转。
- 显式依赖注入。
- 结构化生命周期。
- 明确的资源所有权。
- 渐进式披露。
- 原生 Three.js 逃生口。

本阶段不提供 Vue、React 或其他 UI 框架的专用适配。

---

## 2. 设计原则

### 2.1 封装流程，不替代对象模型

应当封装：

- 应用启动和停止。
- 渲染循环。
- Resize 和设备像素比。
- Feature 安装与卸载。
- 回调和事件的自动清理。
- 资产加载、缓存和释放。
- 模块依赖检查。
- 交互事件分发。
- 错误处理和调试信息。

不应全面封装：

- `THREE.Object3D`。
- `THREE.Mesh`。
- `THREE.Material`。
- `THREE.BufferGeometry`。
- `THREE.Texture`。
- `THREE.Camera`。
- `THREE.WebGLRenderer`。

用户必须能够直接使用 Three.js：

```ts
setup(ctx) {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0x409eff })
  const mesh = new THREE.Mesh(geometry, material)

  ctx.scene.add(mesh)
}
```

### 2.2 简单场景简单表达

一个基础应用应当只需要：

```ts
const app = createThreeApp({
  canvas,
  camera: {
    type: 'perspective',
    position: [4, 3, 6],
  },
})

app.use(environmentFeature())
app.use(factoryFeature())

await app.start()
```

用户不需要重复处理：

- `requestAnimationFrame`。
- `Clock`。
- Canvas 尺寸。
- Camera aspect。
- Renderer pixel ratio。
- Feature 初始化顺序。
- 事件解绑。
- 应用销毁。

### 2.3 高级能力不受限制

任何高层 API 都不能阻止用户：

- 访问原生 Renderer、Scene 和 Camera。
- 添加自定义 Shader。
- 使用 Three.js examples 中的扩展。
- 创建自定义渲染管线。
- 替换默认 Camera。
- 接管特定渲染阶段。

### 2.4 默认行为应当可预测

框架不能在用户不知情的情况下：

- 自动克隆所有对象。
- 遍历并销毁外部传入资源。
- 修改材质参数。
- 改变对象层级。
- 捕获并吞掉异常。
- 自动覆盖用户注册的服务。

所有隐式行为都必须有明确规则，并且能够关闭。

---

## 3. 总体架构

建议将运行时拆分为以下层次：

```text
Application API
    │
    ├── ThreeApp
    ├── Feature Registry
    └── Application Lifecycle
            │
            ├── Runtime Context
            ├── Service Container
            ├── Scheduler
            ├── Asset Manager
            ├── Input Manager
            ├── Render Pipeline
            └── Diagnostics
                    │
                    └── Native Three.js
```

各层职责如下：

### Application API

面向最终用户，负责：

- 创建应用。
- 注册 Feature。
- 启动、暂停和销毁应用。
- 暴露少量全局能力。

### Runtime Context

面向 Feature，负责提供：

- Three.js 核心对象。
- 当前 Feature 的生命周期作用域。
- 资产、调度器和输入等公共能力。
- 服务注册与查询。

### Feature

一个独立的业务或基础设施能力，例如：

- 环境与灯光。
- 工厂模型。
- 设备选择。
- 相机控制。
- 标签系统。
- 后处理。
- 性能监控。

### Native Three.js

保留 Three.js 原生表达能力，框架不创建平行对象体系。

---

## 4. 推荐包结构

早期不建议拆分过多 npm 包，可以先采用单包、内部模块化结构：

```text
src/
  app/
    ThreeApp.ts
    createThreeApp.ts
    AppOptions.ts

  feature/
    ThreeFeature.ts
    FeatureRegistry.ts
    FeatureScope.ts
    FeatureError.ts

  context/
    ThreeContext.ts
    createContext.ts

  lifecycle/
    Lifecycle.ts
    Disposable.ts
    CleanupStack.ts

  scheduler/
    Scheduler.ts
    FrameTask.ts
    FixedStepLoop.ts

  services/
    ServiceKey.ts
    ServiceContainer.ts

  assets/
    AssetManager.ts
    AssetLoader.ts
    AssetHandle.ts
    AssetCache.ts
    loaders/
      TextureAssetLoader.ts
      GltfAssetLoader.ts

  rendering/
    RendererFactory.ts
    CameraFactory.ts
    RenderPipeline.ts
    ResizeController.ts
    PixelRatioController.ts

  input/
    InputManager.ts
    PointerDispatcher.ts
    InteractiveObjectRegistry.ts

  diagnostics/
    Logger.ts
    RuntimeStats.ts
    RuntimeInspector.ts

  features/
    orbit-controls/
    environment/
    selection/
    postprocessing/

  index.ts
```

当核心 API 稳定后，再考虑拆成：

```text
@scope/three-runtime
@scope/three-assets
@scope/three-input
@scope/three-features
```

第一阶段避免拆包，原因是过早拆包会增加：

- 版本同步成本。
- 循环依赖风险。
- 构建配置复杂度。
- API 调整成本。

---

## 5. ThreeApp

`ThreeApp` 是运行时的唯一应用入口。

### 5.1 对外接口

```ts
export interface ThreeApp {
  readonly state: AppState
  readonly scene: THREE.Scene
  readonly camera: THREE.Camera
  readonly renderer: THREE.WebGLRenderer

  use(feature: ThreeFeature): this
  start(): Promise<void>
  pause(): void
  resume(): void
  render(): void
  dispose(): Promise<void>
}

export type AppState =
  | 'created'
  | 'starting'
  | 'running'
  | 'paused'
  | 'disposing'
  | 'disposed'
  | 'failed'
```

### 5.2 创建参数

```ts
export interface ThreeAppOptions {
  canvas: HTMLCanvasElement

  scene?: THREE.Scene | SceneOptions
  camera?: THREE.Camera | CameraOptions
  renderer?: THREE.WebGLRenderer | RendererOptions

  renderMode?: 'continuous' | 'on-demand'
  fixedStep?: number
  maxDelta?: number

  pixelRatio?: number | 'device' | PixelRatioPolicy
  resize?: boolean | ResizeOptions

  errorPolicy?: 'throw' | 'stop' | 'continue'
  logger?: Logger
}
```

规则：

- 允许传入现有 Three.js 实例。
- 传入实例时，默认视为外部所有。
- 外部所有对象不会被运行时自动 `dispose()`。
- 配置对象由运行时负责创建对象。
- 运行时创建的对象默认由运行时负责销毁。

### 5.3 状态约束

- `use()` 默认只允许在 `start()` 前调用。
- `start()` 只能成功执行一次。
- `pause()` 停止逐帧更新和自动渲染，但不销毁 Feature。
- `resume()` 从暂停状态继续。
- `dispose()` 应当幂等。
- 已销毁应用调用其他操作时应抛出明确错误。

后续可以增加运行时动态 Feature，但不建议第一版实现，以免引入复杂的依赖增删和回滚逻辑。

---

## 6. Feature 模型

Feature 是代码组织的核心单位。

### 6.1 基础接口

```ts
export interface ThreeFeature {
  readonly name: string
  readonly provides?: readonly ServiceKey<unknown>[]
  readonly dependencies?: readonly ServiceKey<unknown>[]
  readonly optionalDependencies?: readonly ServiceKey<unknown>[]

  setup(context: ThreeContext): void | Promise<void>
}
```

推荐使用工厂函数创建 Feature：

```ts
export function factoryFeature(options: FactoryOptions = {}): ThreeFeature {
  return {
    name: 'factory',
    provides: [FactoryModelService],

    async setup(ctx) {
      // 初始化当前功能
    },
  }
}
```

不建议要求用户继承基类：

```ts
class FactoryFeature extends BaseFeature {}
```

原因：

- 组合比继承更灵活。
- 工厂函数更容易闭包保存配置。
- 测试更简单。
- 避免形成复杂继承层级。

### 6.2 Feature 应负责什么

一个业务 Feature 应尽量完整拥有：

- 自身场景根节点。
- 所需资产句柄。
- 交互注册。
- 逐帧逻辑。
- 对外服务。
- 清理逻辑。

示例：

```ts
export function factoryFeature(): ThreeFeature {
  return {
    name: 'factory',

    async setup(ctx) {
      const root = new THREE.Group()
      root.name = 'factory-feature'
      ctx.scene.add(root)
      ctx.own(root)

      const model = await ctx.assets.acquireGLTF('/models/factory.glb')
      root.add(model.value.scene)
      ctx.retain(model)

      ctx.onUpdate(({ delta }) => {
        updateMachines(delta)
      })

      ctx.provide(FactoryModelService, {
        root,
        findDevice(id) {
          return root.getObjectByProperty('userData.deviceId', id)
        },
      })
    },
  }
}
```

### 6.3 Feature 命名

名称必须：

- 在应用内唯一。
- 稳定且可读。
- 用于错误信息和调试面板。

重复注册时应直接报错：

```text
Feature "factory" has already been registered.
```

### 6.4 安装顺序

Feature 的注册顺序只作为无依赖关系时的稳定排序依据：

```ts
app
  .use(environmentFeature())
  .use(cameraControlFeature())
  .use(factoryFeature())
```

启动时：

1. 验证名称是否重复。
2. 根据 `provides` 建立服务提供者索引。
3. 验证服务是否存在重复提供者。
4. 验证所有必需依赖是否可以满足。
5. 根据服务依赖建立 Feature 有向图。
6. 检测循环依赖。
7. 对依赖图执行稳定拓扑排序；无依赖关系时保持注册顺序。
8. 按拓扑顺序执行 `setup()`。
9. 验证 `setup()` 是否实际提供了其声明的全部服务。
10. 任一 Feature 初始化失败时停止启动。
11. 按已完成初始化顺序的反方向回滚。

反向销毁非常重要：

```text
安装：A → B → C
销毁：C → B → A
```

---

## 7. ThreeContext

Context 是 Feature 使用运行时能力的入口。

### 7.1 接口建议

```ts
export interface ThreeContext {
  readonly app: ThreeApp
  readonly scene: THREE.Scene
  readonly camera: THREE.Camera
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement

  readonly assets: AssetManager
  readonly input: InputManager
  readonly scheduler: Scheduler

  onUpdate(callback: UpdateCallback, options?: TaskOptions): Disposable
  onFixedUpdate(callback: FixedUpdateCallback, options?: TaskOptions): Disposable
  onBeforeRender(callback: RenderCallback, options?: TaskOptions): Disposable
  onAfterRender(callback: RenderCallback, options?: TaskOptions): Disposable

  provide<T>(key: ServiceKey<T>, service: T): void
  inject<T>(key: ServiceKey<T>): T
  injectOptional<T>(key: ServiceKey<T>): T | undefined

  own(object: THREE.Object3D): void
  retain<T>(handle: AssetHandle<T>): void
  addCleanup(cleanup: Cleanup): Disposable
  invalidate(): void
}
```

### 7.2 Context 的作用域

每个 Feature 获得独立 Context 实例。

Context 内部绑定当前 Feature 的 `FeatureScope`，因此：

- `ctx.onUpdate()` 注册的任务属于当前 Feature。
- `ctx.input.on()` 注册的交互属于当前 Feature。
- `ctx.retain()` 保存的资产引用属于当前 Feature。
- `ctx.addCleanup()` 注册的清理函数属于当前 Feature。
- Feature 销毁时统一释放。

这使用户不需要手动保存大量取消函数。

### 7.3 避免万能 Context

Context 不应该保存任意业务状态：

```ts
ctx.currentSelectedDevice = ...
ctx.factoryData = ...
```

业务能力应该通过服务提供：

```ts
ctx.provide(SelectionService, selectionService)
```

这样才能保留明确的模块边界。

---

## 8. 生命周期与清理

### 8.1 CleanupStack

每个 Feature 应拥有一个后进先出的清理栈：

```ts
export type Cleanup =
  | (() => void | Promise<void>)
  | Disposable

export interface Disposable {
  dispose(): void | Promise<void>
}
```

注册顺序：

```ts
ctx.addCleanup(cleanupA)
ctx.addCleanup(cleanupB)
ctx.addCleanup(cleanupC)
```

执行顺序：

```text
cleanupC → cleanupB → cleanupA
```

### 8.2 自动绑定的资源

以下操作必须自动绑定 Feature 作用域：

- 更新回调。
- DOM 事件。
- Three.js 交互事件。
- 定时器。
- 资产句柄。
- 自有场景节点。
- 自定义清理函数。

例如：

```ts
ctx.addCleanup(
  listen(window, 'keydown', event => {
    // ...
  }),
)
```

也可以提供便捷方法：

```ts
ctx.events.on(window, 'keydown', callback)
```

### 8.3 异步初始化取消

Feature 初始化可能在资源加载期间被销毁。每个作用域应提供 `AbortSignal`：

```ts
export interface ThreeContext {
  readonly signal: AbortSignal
}
```

资产加载器和用户异步任务应接收该信号：

```ts
const data = await fetch(url, {
  signal: ctx.signal,
})
```

需要注意：

- `AbortSignal` 可以取消等待流程。
- 浏览器缓存或 Three.js Loader 底层请求未必真正停止。
- 即使底层请求不能停止，也必须阻止结果进入已销毁 Feature。

### 8.4 销毁错误

销毁期间不应因为一个清理函数失败而跳过剩余清理项。

建议收集全部错误后抛出 `AggregateError`：

```ts
await scope.dispose()
```

日志应包含：

- Feature 名称。
- 失败的清理项。
- 原始异常。

---

## 9. 调度器与渲染循环

### 9.1 渲染阶段

建议定义明确阶段：

```text
begin-frame
  → fixed-update
  → update
  → before-render
  → render
  → after-render
  → end-frame
```

第一版公开：

- `onFixedUpdate`。
- `onUpdate`。
- `onBeforeRender`。
- `onAfterRender`。

### 9.2 回调参数

```ts
export interface FrameInfo {
  readonly delta: number
  readonly elapsed: number
  readonly frame: number
  readonly time: number
}

export type UpdateCallback = (frame: FrameInfo) => void
```

其中：

- `delta` 单位为秒。
- `elapsed` 是应用运行累计时间。
- `frame` 是帧序号。
- `time` 是当前高精度时间戳。

### 9.3 Delta 限制

浏览器标签页恢复后，`delta` 可能非常大。运行时应限制：

```ts
const delta = Math.min(rawDelta, maxDelta)
```

默认建议：

```ts
maxDelta: 0.1
```

这不是物理模拟的完整解决方案，但能避免普通动画瞬间跳跃。

### 9.4 固定时间步

物理、仿真或确定性逻辑可以使用固定时间步：

```ts
createThreeApp({
  fixedStep: 1 / 60,
})
```

内部使用累加器：

```ts
accumulator += delta

while (accumulator >= fixedStep) {
  runFixedUpdate(fixedStep)
  accumulator -= fixedStep
}
```

必须设置单帧最大迭代次数，防止死亡螺旋：

```ts
maxFixedStepsPerFrame: 5
```

### 9.5 任务优先级

可以提供有限的优先级机制：

```ts
ctx.onUpdate(updateCamera, { priority: -100 })
ctx.onUpdate(updateScene, { priority: 0 })
ctx.onUpdate(updateLabels, { priority: 100 })
```

规则：

- 数字越小越早执行。
- 相同优先级按注册顺序执行。
- 不要提供过多具名阶段，否则 API 会快速膨胀。

### 9.6 连续渲染与按需渲染

支持两种模式：

```ts
renderMode: 'continuous'
renderMode: 'on-demand'
```

连续模式适合：

- 动画。
- 物理。
- 实时数据。
- 相机持续移动。

按需模式适合：

- 静态模型查看。
- 配置器。
- 数据变化频率较低的数字孪生。

按需模式中，Feature 调用：

```ts
ctx.invalidate()
```

调度下一次渲染。同一事件循环内多次调用应合并。

---

## 10. Renderer、Scene 与 Camera

### 10.1 Renderer 创建

```ts
export interface RendererOptions {
  antialias?: boolean
  alpha?: boolean
  powerPreference?: WebGLPowerPreference
  logarithmicDepthBuffer?: boolean
  preserveDrawingBuffer?: boolean

  shadows?: boolean | THREE.ShadowMapType
  outputColorSpace?: THREE.ColorSpace
  toneMapping?: THREE.ToneMapping
  toneMappingExposure?: number
}
```

Renderer 参数应直接映射到 Three.js 概念，避免创建新的术语。

### 10.2 Camera 创建

```ts
export type CameraOptions =
  | PerspectiveCameraOptions
  | OrthographicCameraOptions

export interface PerspectiveCameraOptions {
  type: 'perspective'
  fov?: number
  near?: number
  far?: number
  position?: Vector3Like
  target?: Vector3Like
}
```

`Vector3Like` 可以支持：

```ts
type Vector3Like =
  | THREE.Vector3
  | readonly [number, number, number]
  | { x: number; y: number; z: number }
```

但内部最终必须使用原生 `THREE.Vector3`。

### 10.3 Camera 替换

如果应用需要切换相机，不能只在 Context 中保存启动时的 Camera 引用。

建议应用提供：

```ts
app.setCamera(camera)
```

Context 中的 `camera` 应通过 getter 获取当前相机：

```ts
get camera() {
  return app.activeCamera
}
```

否则 Feature 容易长期持有过期相机。

### 10.4 Resize

ResizeController 默认监听 Canvas 容器，而不是只监听 `window.resize`。

优先使用：

```ts
ResizeObserver
```

Resize 时：

1. 获取 Canvas 的 CSS 尺寸。
2. 更新 Renderer 尺寸。
3. 更新 PerspectiveCamera aspect。
4. 更新 OrthographicCamera 投影视锥。
5. 通知依赖尺寸的渲染管线。
6. 请求重新渲染。

应避免无条件每帧调用 `renderer.setSize()`。

### 10.5 Pixel Ratio

直接使用完整 `devicePixelRatio` 可能造成过高 GPU 压力。

建议默认策略：

```ts
pixelRatio: {
  mode: 'device',
  max: 2,
}
```

后续可以增加动态分辨率，但不建议纳入第一版核心。

---

## 11. RenderPipeline

第一版可以内置默认管线：

```ts
renderer.render(scene, camera)
```

同时允许 Feature 替换默认渲染管线：

```ts
export interface RenderPipeline {
  setSize(width: number, height: number, pixelRatio: number): void
  render(context: RenderContext): void
  dispose(): void
}
```

例如后处理 Feature：

```ts
export function postprocessingFeature(): ThreeFeature {
  return {
    name: 'postprocessing',

    setup(ctx) {
      const composer = new EffectComposer(ctx.renderer)
      const pipeline = createComposerPipeline(composer)

      ctx.rendering.setPipeline(pipeline)
      ctx.addCleanup(pipeline)
    },
  }
}
```

约束：

- 同一时间只能存在一个主 RenderPipeline。
- 重复设置时默认报错。
- 不允许 Feature 静默覆盖其他 Feature 的管线。
- 调试信息需要显示当前管线提供者。

---

## 12. 服务与依赖注入

### 12.1 ServiceKey

不要用字符串作为服务标识：

```ts
ctx.inject('selection')
```

推荐使用强类型 Token：

```ts
export interface ServiceKey<T> {
  readonly id: symbol
  readonly description: string
}

export function createServiceKey<T>(description: string): ServiceKey<T> {
  return {
    id: Symbol(description),
    description,
  }
}
```

定义服务：

```ts
export interface SelectionService {
  readonly selected: readonly THREE.Object3D[]
  select(object: THREE.Object3D): void
  clear(): void
}

export const SelectionService =
  createServiceKey<SelectionService>('selection')
```

### 12.2 提供服务

```ts
ctx.provide(SelectionService, service)
```

规则：

- 同一个 Key 默认只能注册一次。
- 错误信息必须包含提供者 Feature。
- 服务随提供者 Feature 销毁而失效。
- 不允许使用已失效服务。

### 12.3 声明依赖

```ts
export function inspectionFeature(): ThreeFeature {
  return {
    name: 'inspection',
    dependencies: [SelectionService, CameraControlService],

    setup(ctx) {
      const selection = ctx.inject(SelectionService)
      const camera = ctx.inject(CameraControlService)
    },
  }
}
```

提供服务的 Feature 必须静态声明：

```ts
export function selectionFeature(): ThreeFeature {
  return {
    name: 'selection',
    provides: [SelectionService],

    setup(ctx) {
      ctx.provide(SelectionService, createSelectionService())
    },
  }
}
```

启动前进行依赖验证，比运行过程中出现 `undefined` 更容易诊断。`provides` 是依赖图契约；如果声明但未调用 `ctx.provide()`，该 Feature 的初始化必须失败。

### 12.4 第一版作用域

第一版只实现应用级服务容器：

- 一个应用一个容器。
- Feature 可以注册服务。
- Feature 可以消费其依赖图上游提供的服务。

暂不实现：

- 层级容器。
- 请求作用域。
- 自动构造函数注入。
- 装饰器注入。
- 反射元数据。

这些能力会显著增加复杂度，却不能直接改善 Three.js 使用体验。

---

## 13. 资产管理

资产管理是整个封装中最有价值、也最需要谨慎定义所有权的部分。

### 13.1 设计目标

- 相同资源请求去重。
- 并发请求合并。
- 缓存加载结果。
- 支持加载进度。
- 支持错误重试。
- 支持引用计数。
- 支持显式释放。
- 支持预加载。
- 区分共享资产与实例对象。

### 13.2 Loader 扩展接口

```ts
export interface AssetLoader<T, O = unknown> {
  readonly type: string

  load(
    source: string,
    options: O,
    context: AssetLoadContext,
  ): Promise<T>

  dispose?(asset: T): void
}
```

注册加载器：

```ts
assets.registerLoader(textureLoader)
assets.registerLoader(gltfLoader)
```

### 13.3 AssetKey

缓存键不能只使用 URL，因为加载参数也可能影响结果。

```ts
export interface AssetKey {
  type: string
  source: string
  variant?: string
}
```

例如：

```ts
{
  type: 'texture',
  source: '/textures/floor.webp',
  variant: 'srgb'
}
```

### 13.4 AssetHandle

不建议直接返回缓存对象后完全依赖用户手动释放：

```ts
const texture = await assets.loadTexture(url)
```

更安全的是返回句柄：

```ts
export interface AssetHandle<T> extends Disposable {
  readonly value: T
  readonly key: AssetKey
  readonly released: boolean
}
```

使用方式：

```ts
const handle = await ctx.assets.acquireTexture('/floor.webp')
ctx.retain(handle)

const texture = handle.value
```

Feature 销毁时，`ctx.retain()` 自动释放引用。

### 13.5 并发合并

以下两个请求应共用一个加载 Promise：

```ts
const a = assets.acquireTexture('/floor.webp')
const b = assets.acquireTexture('/floor.webp')
```

加载成功后：

- 创建两个 Handle。
- 引用计数为 2。
- 两个 Handle 的 `value` 指向同一个共享 Texture。

### 13.6 GLTF 的共享问题

GLTF 不能简单地把同一个 `scene` 同时添加到多个父节点。

因此需要区分：

```ts
const asset = await assets.acquireGLTF(url)
const instance = asset.instantiate()
```

可选实例化策略：

```ts
type GltfInstantiateMode =
  | 'clone'
  | 'skeleton-clone'
  | 'shared'
```

- `clone`：普通 `Object3D.clone(true)`。
- `skeleton-clone`：使用 `SkeletonUtils.clone()`。
- `shared`：返回原对象，只允许单一挂载场景。

默认策略根据是否存在 SkinnedMesh 自动选择，具体实例与共享资源契约见第 34.6 节。

### 13.7 资源释放

以下资源通常需要 `dispose()`：

- `BufferGeometry`。
- `Material`。
- `Texture`。
- `WebGLRenderTarget`。
- 后处理 Pass。

但不能盲目递归销毁整个模型，因为：

- 材质可能共享。
- 纹理可能共享。
- Geometry 可能来自缓存。
- 外部资源可能仍在使用。

推荐规则：

1. AssetManager 加载并缓存的资源由 AssetManager 负责。
2. Feature 自己 `new` 的资源由 Feature 负责。
3. 外部传入的资源默认由外部负责。
4. 所有权转移必须显式声明。
5. 对象从 Scene 移除不等于 GPU 资源已经释放。

可以提供工具函数，但不自动调用：

```ts
disposeObjectTree(root, {
  geometries: true,
  materials: true,
  textures: false,
})
```

### 13.8 缓存策略

初期建议使用引用计数加延迟释放：

```ts
cache.releaseDelay = 30_000
```

原因：

- 页面切换时资源可能短时间内重新使用。
- 立即释放会造成频繁重新请求和 GPU 上传。

应支持：

```ts
assets.clearUnused()
assets.clearAll()
assets.getStats()
```

---

## 14. 场景对象所有权

`ctx.own(object)` 用于声明某个场景节点属于当前 Feature：

```ts
const root = new THREE.Group()
ctx.scene.add(root)
ctx.own(root)
```

Feature 销毁时：

1. 从父节点移除该对象。
2. 清除与该对象相关的输入注册。
3. 不默认递归释放 Geometry、Material 和 Texture。

资源释放必须通过：

- `ctx.retain(assetHandle)`。
- `ctx.addCleanup(resource)`。
- 显式资源工具。

这样可以避免“对象树所有权”和“GPU 资源所有权”混为一谈。

可以提供便捷方法创建完全自有对象：

```ts
ctx.ownObject(mesh, {
  disposeGeometry: true,
  disposeMaterial: true,
  disposeTextures: false,
})
```

但此功能应当是显式选择，而不是默认行为。

---

## 15. 输入与 3D 交互

### 15.1 目标

统一处理：

- Pointer 坐标转换。
- Raycaster。
- 点击与双击。
- Hover enter/leave。
- Pointer down/up/move。
- 对象层级冒泡。
- 事件取消。
- DOM 与 3D 事件协调。
- Feature 卸载后的自动解绑。

### 15.2 基础 API

```ts
ctx.input.on(mesh, 'click', event => {
  console.log(event.object)
})

ctx.input.on(mesh, 'pointerenter', event => {
  event.object.scale.setScalar(1.05)
})
```

返回 Disposable，同时自动绑定当前 Feature：

```ts
const listener = ctx.input.on(mesh, 'click', handler)
listener.dispose()
```

### 15.3 事件对象

```ts
export interface ThreePointerEvent {
  readonly type: ThreePointerEventType
  readonly nativeEvent: PointerEvent
  readonly object: THREE.Object3D
  readonly currentTarget: THREE.Object3D
  readonly intersection: THREE.Intersection
  readonly intersections: readonly THREE.Intersection[]
  readonly point: THREE.Vector3
  readonly uv?: THREE.Vector2

  stopPropagation(): void
}
```

### 15.4 Raycast 优化

不能每次 Pointer move 都对整个 Scene 做射线检测。

应维护可交互对象注册表：

```ts
ctx.input.on(object, 'click', handler)
```

注册第一个事件时将对象加入交互集合；最后一个事件解绑时移除。

后续可增加：

- Layer 过滤。
- 自定义 `raycast`。
- BVH。
- Pointer move 节流。

第一版只需要正确的注册表和射线检测边界。

### 15.5 事件传播

建议支持从命中对象向父节点冒泡：

```text
hit mesh → parent group → feature root
```

但只向已注册监听器的父节点分发。

用户可以调用：

```ts
event.stopPropagation()
```

---

## 16. 内置 Feature 建议

核心运行时稳定前，只提供少量通用 Feature。

### 16.1 Environment Feature

负责：

- Scene background。
- 环境贴图。
- 基础灯光。
- 可选 Ground。

```ts
app.use(
  environmentFeature({
    background: 0x101820,
    ambientLight: {
      color: 0xffffff,
      intensity: 0.5,
    },
  }),
)
```

### 16.2 Orbit Controls Feature

```ts
app.use(
  orbitControlsFeature({
    damping: true,
    target: [0, 1, 0],
  }),
)
```

Feature 负责：

- 创建 Controls。
- 每帧更新。
- 按需渲染失效通知。
- Resize 或 Camera 替换后的同步。
- Controls 销毁。
- 提供 `CameraControlService`。

### 16.3 Selection Feature

负责：

- 单选和多选状态。
- 选择变化事件。
- SelectionService。

不建议在核心选择模块中强制实现具体高亮效果。高亮可以作为依赖 SelectionService 的独立 Feature。

### 16.4 Stats Feature

调试环境下提供：

- FPS。
- Draw calls。
- Triangles。
- Geometries。
- Textures。
- Feature 数量。
- Scheduler 任务数量。
- Asset cache 状态。

生产构建可以不安装。

---

## 17. 业务代码组织方式

推荐按照业务功能组织：

```text
src/
  three/
    app.ts

    features/
      environment/
        environment.feature.ts
        environment.options.ts

      factory/
        factory.feature.ts
        factory.assets.ts
        factory.service.ts
        factory.types.ts
        materials/
        interactions/

      selection/
        selection.feature.ts
        selection.service.ts

      inspection/
        inspection.feature.ts
        inspection.service.ts
```

不推荐把全部代码按 Three.js 类型拆开：

```text
meshes/
materials/
textures/
loaders/
events/
```

后一种结构在小项目中看起来整齐，但当修改“工厂设备选中效果”时，往往需要跨越多个目录。

Feature-first 的判断标准是：

> 删除一个功能时，能否主要通过删除一个目录完成。

### Feature 内部允许继续分层

大型 Feature 可以内部拆分：

```text
factory/
  factory.feature.ts
  domain/
  assets/
  rendering/
  interaction/
```

但这些目录应属于 factory，而不是变成整个应用共享的技术目录。

---

## 18. 完整使用示例

### 18.1 创建应用

```ts
import {
  createThreeApp,
  environmentFeature,
  orbitControlsFeature,
} from '@scope/three-runtime'

import { factoryFeature } from './features/factory'
import { inspectionFeature } from './features/inspection'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')

if (!canvas) {
  throw new Error('Scene canvas was not found.')
}

const app = createThreeApp({
  canvas,
  camera: {
    type: 'perspective',
    fov: 45,
    near: 0.1,
    far: 2_000,
    position: [8, 6, 10],
    target: [0, 1, 0],
  },
  renderer: {
    antialias: true,
    shadows: true,
    toneMapping: THREE.ACESFilmicToneMapping,
  },
  pixelRatio: {
    mode: 'device',
    max: 2,
  },
  renderMode: 'continuous',
})

app
  .use(environmentFeature())
  .use(orbitControlsFeature())
  .use(factoryFeature({ source: '/models/factory.glb' }))
  .use(inspectionFeature())

await app.start()
```

### 18.2 页面卸载

```ts
window.addEventListener(
  'pagehide',
  () => {
    void app.dispose()
  },
  { once: true },
)
```

### 18.3 Factory 服务

```ts
export interface FactoryService {
  readonly root: THREE.Object3D
  findDevice(id: string): THREE.Object3D | undefined
}

export const FactoryService =
  createServiceKey<FactoryService>('factory')
```

### 18.4 Factory Feature

```ts
export function factoryFeature(options: FactoryOptions): ThreeFeature {
  return {
    name: 'factory',

    async setup(ctx) {
      const root = new THREE.Group()
      root.name = 'factory'
      ctx.scene.add(root)
      ctx.own(root)

      const gltf = await ctx.assets.acquireGLTF(options.source, {
        signal: ctx.signal,
      })
      ctx.retain(gltf)

      const model = gltf.instantiate()
      root.add(model)

      ctx.provide(FactoryService, {
        root,

        findDevice(id) {
          let result: THREE.Object3D | undefined

          root.traverse(object => {
            if (object.userData.deviceId === id) {
              result = object
            }
          })

          return result
        },
      })
    },
  }
}
```

### 18.5 Inspection Feature

```ts
export function inspectionFeature(): ThreeFeature {
  return {
    name: 'inspection',
    dependencies: [FactoryService, CameraControlService],

    setup(ctx) {
      const factory = ctx.inject(FactoryService)
      const camera = ctx.inject(CameraControlService)

      ctx.input.on(factory.root, 'dblclick', event => {
        camera.focus(event.object)
      })
    },
  }
}
```

---

## 19. 错误处理

### 19.1 错误类型

建议定义少量可识别错误：

```ts
class ThreeRuntimeError extends Error {}
class AppStateError extends ThreeRuntimeError {}
class FeatureSetupError extends ThreeRuntimeError {}
class MissingServiceError extends ThreeRuntimeError {}
class DuplicateServiceError extends ThreeRuntimeError {}
class AssetLoadError extends ThreeRuntimeError {}
class DisposedScopeError extends ThreeRuntimeError {}
```

不要为每个细节都创建错误类。

### 19.2 Feature 初始化错误

错误信息应提供上下文：

```text
Failed to initialize feature "factory".
Asset: /models/factory.glb
Cause: Unexpected token in GLTF JSON.
```

原始异常通过 `cause` 保留：

```ts
throw new FeatureSetupError(message, {
  cause: error,
})
```

### 19.3 帧循环错误

默认建议使用 `stop` 策略：

- 停止后续帧。
- 保留当前应用状态用于调试。
- 记录失败 Feature 和阶段。
- 将异常重新抛到宿主环境。

`continue` 风险较高，只应明确配置后启用。

### 19.4 异步 Feature 回滚

如果 Feature C 初始化失败：

```text
A setup success
B setup success
C setup failed
```

运行时必须：

```text
dispose C partial scope
dispose B
dispose A
dispose app-owned infrastructure
```

即使 `setup()` 未完成，Feature Scope 中已经注册的清理项也必须执行。

---

## 20. 日志与诊断

### 20.1 Logger

```ts
export interface Logger {
  debug(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}
```

运行时不应直接散布 `console.log()`。

### 20.2 开发模式检查

开发模式可以检查：

- Feature 名称重复。
- 服务重复注册。
- 缺失依赖。
- 已销毁 Scope 中继续注册任务。
- AssetHandle 重复释放。
- 应用销毁后仍调用 `invalidate()`。
- 一个对象被多个 Feature 声明所有权。
- RenderPipeline 被重复覆盖。

生产模式可以关闭部分昂贵检查。

### 20.3 Runtime Inspector

提供只读快照：

```ts
app.inspect()
```

返回：

```ts
interface RuntimeSnapshot {
  state: AppState
  features: FeatureSnapshot[]
  scheduler: SchedulerSnapshot
  assets: AssetCacheSnapshot
  renderer: RendererSnapshot
}
```

不要让 Inspector 暴露可随意修改的内部集合。

---

## 21. TypeScript API 设计

### 21.1 优先使用接口与组合

公共 API 尽量是接口和工厂函数：

```ts
createThreeApp()
createServiceKey()
createFeature()
```

内部实现可以使用类，但不要求用户继承。

### 21.2 避免布尔参数

不推荐：

```ts
loadModel(url, true, false)
```

推荐：

```ts
loadModel(url, {
  clone: true,
  cache: false,
})
```

### 21.3 避免过度链式 API

链式 API 只用于 Feature 注册：

```ts
app.use(a).use(b)
```

不要把所有操作都设计成链式调用，否则：

- 异步错误处理困难。
- 类型推导复杂。
- 调试调用结果不直观。

### 21.4 保持 Three.js 命名

已经存在于 Three.js 中的概念保持原名：

- `scene`。
- `camera`。
- `renderer`。
- `material`。
- `geometry`。
- `texture`。
- `raycaster`。

不要创造 `world`、`viewportEngine`、`visualNode` 等平行术语，除非确实表示不同概念。

### 21.5 导出边界

根入口只导出稳定 API：

```ts
export {
  createThreeApp,
  createServiceKey,
}

export type {
  ThreeApp,
  ThreeFeature,
  ThreeContext,
  AssetHandle,
  Disposable,
}
```

内部类不要全部导出，避免用户依赖实现细节。

---

## 22. 测试策略

### 22.1 单元测试

不依赖真实 WebGL 的模块应覆盖：

- FeatureRegistry。
- ServiceContainer。
- CleanupStack。
- Scheduler 排序。
- FixedStep accumulator。
- AssetCache 引用计数。
- 并发加载合并。
- 状态机。
- 错误回滚。

### 22.2 生命周期测试

必须验证：

```text
setup order: A → B → C
dispose order: C → B → A
```

并验证：

- 重复 dispose 不会重复释放。
- setup 失败后已注册清理项仍执行。
- 一个清理项失败不影响其他清理项。
- 已销毁 Feature 不再收到 update。

### 22.3 AssetManager 测试

重点覆盖：

- 同 Key 并发请求只调用一次 Loader。
- 两个 Handle 独立释放。
- 引用归零后按策略释放。
- 加载失败不污染缓存。
- 失败后可以重试。
- Abort 后不会把结果交给已销毁 Scope。
- 外部所有资源不会被自动销毁。

### 22.4 浏览器集成测试

使用真实浏览器测试：

- WebGL Renderer 创建。
- ResizeObserver。
- Pointer 交互。
- Canvas 坐标换算。
- Context lost/restored。
- 应用销毁后 WebGL 资源是否下降。

可建立小型测试场景，不要用大型业务模型作为基础测试依赖。

### 22.5 示例即验收标准

至少维护以下示例：

```text
01-basic-scene
02-feature-composition
03-assets-and-disposal
04-pointer-interaction
05-on-demand-rendering
06-postprocessing
07-feature-failure-rollback
```

每个示例只展示一个主要概念。

---

## 23. 性能边界

### 23.1 运行时不应每帧执行的操作

- 遍历整个 Scene 查找更新对象。
- 自动扫描资源。
- 调用 `renderer.setSize()`。
- 创建临时 Vector。
- 重建任务数组。
- 对整个 Scene 执行 Raycast。
- 深度比较声明式配置。

更新任务应在注册时组织好：

```ts
ctx.onUpdate(callback)
```

帧循环只遍历当前有效任务。

### 23.2 回调删除

不要在每次删除任务时对大数组进行频繁重排。可以采用：

- 标记失效。
- 帧结束后批量压缩。
- 按优先级分桶。

但第一版优先正确性，确认性能瓶颈后再优化数据结构。

### 23.3 对象池

核心不要内置通用对象池。

Three.js 中只有特定高频临时对象适合池化。通用对象池会：

- 增加所有权复杂度。
- 隐藏对象生命周期。
- 未必提升性能。

对象池应由具体 Feature 按需实现。

---

## 24. 明确不做的事情

第一版不提供：

- Vue 专用封装。
- React 专用封装。
- JSX 场景描述。
- 自定义声明式渲染器。
- ECS。
- 可视化编辑器。
- 完整物理引擎抽象。
- 自定义动画系统替代 `AnimationMixer`。
- 自定义材质系统替代 Three.js Material。
- 自动序列化整个场景。
- 运行时热插拔任意 Feature。
- 装饰器依赖注入。
- 全自动递归资源释放。
- 对所有 Three.js examples 扩展进行包装。

这些能力可以以后以独立模块扩展，但不应进入核心。

---

## 25. 常见反模式

### 25.1 为每个 Three.js 类创建包装类

```ts
class MyMesh extends THREE.Mesh {}
class MyMaterial extends THREE.Material {}
```

问题：

- API 数量翻倍。
- Three.js 升级同步困难。
- 用户仍然必须学习 Three.js。
- 第三方扩展兼容性下降。

### 25.2 创建巨型 Viewer 类

```ts
viewer.loadModel()
viewer.select()
viewer.measure()
viewer.addLabel()
viewer.enablePhysics()
viewer.setEnvironment()
```

问题：

- 职责持续增长。
- 模块不能独立复用。
- 测试需要创建完整 Viewer。
- 功能之间通过隐藏状态耦合。

应改为：

```ts
app.use(modelFeature())
app.use(selectionFeature())
app.use(measurementFeature())
```

### 25.3 全局单例

```ts
export const scene = new THREE.Scene()
```

问题：

- 无法同时创建多个应用。
- 测试之间状态污染。
- 生命周期无法控制。
- 模块依赖不透明。

### 25.4 自动销毁整个对象树

问题：

- 共享资源可能仍被使用。
- 外部传入资源可能被错误释放。
- 同一 Texture 可能被多个 Material 使用。

必须明确区分对象树所有权和 GPU 资源所有权。

### 25.5 把业务状态放进 userData

`userData` 可以保存对象标识和轻量元数据，但不应成为全局业务状态仓库。

复杂状态应由业务 Feature 或 Service 管理。

### 25.6 为了声明式而声明式

不建议强迫用户用巨型 JSON 描述所有场景：

```ts
{
  type: 'mesh',
  geometry: {
    type: 'box',
  },
  material: {
    type: 'standard',
  },
}
```

这会重新发明一个能力弱于 JavaScript 和 Three.js 的语言。

配置适合稳定、高频、有限的能力；复杂场景继续使用代码。

---

## 26. 分阶段实施计划

### 阶段一：最小运行时

实现：

- `createThreeApp`。
- App 状态机。
- Scene、Camera、Renderer 创建。
- ResizeController。
- 基础连续渲染循环。
- `ThreeFeature`。
- `ThreeContext`。
- `CleanupStack`。
- `onUpdate`。
- 反向销毁。

验收条件：

- 可以用两个独立 Feature 构建基础场景。
- 应用销毁后不存在 RAF 和 ResizeObserver。
- Feature 初始化失败能够正确回滚。

### 阶段二：服务和调度

实现：

- `ServiceKey`。
- `ServiceContainer`。
- Feature dependencies。
- Update priority。
- Fixed update。
- Pause/resume。
- On-demand rendering。

验收条件：

- Feature 可以显式提供和消费服务。
- 缺失依赖在启动前报告。
- 按需模式不会持续占用渲染循环。

### 阶段三：资产系统

实现：

- Loader 注册。
- AssetKey。
- 并发合并。
- AssetHandle。
- 引用计数。
- 延迟释放。
- Texture 和 GLTF Loader。
- GLTF 实例化。

验收条件：

- 相同资源不会重复请求。
- Feature 销毁后正确减少引用。
- 共享资源不会被提前释放。

### 阶段四：输入系统

实现：

- Pointer 坐标转换。
- 可交互对象注册表。
- Raycast。
- Click、pointer enter/leave。
- 事件冒泡。
- 自动解绑。

验收条件：

- 不需要对整个 Scene Raycast。
- Feature 销毁后对象不再接收事件。
- Canvas Resize 后坐标仍正确。

### 阶段五：通用 Feature 与诊断

实现：

- OrbitControls Feature。
- Environment Feature。
- Selection Feature。
- Stats Feature。
- Runtime Inspector。
- 开发模式检查。

验收条件：

- 常见场景主要通过组合 Feature 构建。
- 核心依然不依赖任何 UI 框架。

---

## 27. API 稳定策略

### 27.1 先稳定概念，再稳定细节

优先稳定：

- `ThreeApp`。
- `ThreeFeature`。
- `ThreeContext`。
- `ServiceKey`。
- `AssetHandle`。
- `Disposable`。

这些概念一旦发布，调整成本较高。

以下实现细节可以保持内部：

- Scheduler 数据结构。
- Cache Map 结构。
- FeatureScope 实现。
- 任务排序算法。
- ResizeObserver 封装。

### 27.2 实验性 API

对尚未稳定的能力使用独立入口：

```ts
import { experimental } from '@scope/three-runtime/experimental'
```

不要把实验 API 直接放进主入口后长期兼容。

### 27.3 Three.js 版本兼容

建议将 `three` 声明为 peer dependency：

```json
{
  "peerDependencies": {
    "three": "支持的版本范围"
  }
}
```

库内部不要打包第二份 Three.js，否则可能出现：

- 类型实例不一致。
- `instanceof` 异常。
- 包体积增加。
- 多份常量和运行时状态。

支持范围应以实际测试为依据，不要声明未经验证的超宽版本范围。

---

## 28. 最终 API 草案

```ts
export interface ThreeApp {
  readonly state: AppState
  readonly graphicsState: GraphicsState
  readonly scene: THREE.Scene
  readonly camera: THREE.Camera
  readonly renderer: THREE.WebGLRenderer

  use(feature: ThreeFeature): this
  start(): Promise<void>
  pause(): void
  resume(): void
  render(): void
  setCamera(camera: THREE.Camera): void
  inspect(): RuntimeSnapshot
  dispose(): Promise<void>
}

export interface ThreeFeature {
  readonly name: string
  readonly provides?: readonly ServiceKey<unknown>[]
  readonly dependencies?: readonly ServiceKey<unknown>[]
  readonly optionalDependencies?: readonly ServiceKey<unknown>[]
  setup(context: ThreeContext): void | Promise<void>
}

export interface ThreeContext {
  readonly app: ThreeApp
  readonly scene: THREE.Scene
  readonly camera: THREE.Camera
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly signal: AbortSignal

  readonly assets: AssetManager
  readonly input: ScopedInputManager
  readonly scheduler: ScopedScheduler
  readonly rendering: ScopedRendering

  onUpdate(callback: UpdateCallback, options?: TaskOptions): Disposable
  onFixedUpdate(callback: FixedUpdateCallback, options?: TaskOptions): Disposable
  onBeforeRender(callback: RenderCallback, options?: TaskOptions): Disposable
  onAfterRender(callback: RenderCallback, options?: TaskOptions): Disposable
  onCameraChanged(callback: CameraChangedCallback): Disposable
  onContextLost(callback: ContextLostCallback): Disposable
  onContextRestored(callback: ContextRestoredCallback): Disposable

  provide<T>(
    key: ServiceKey<T>,
    service: T,
    options?: ProvideServiceOptions,
  ): void
  inject<T>(key: ServiceKey<T>): T
  injectOptional<T>(key: ServiceKey<T>): T | undefined

  own(object: THREE.Object3D): void
  retain<T>(handle: AssetHandle<T>): void
  addCleanup(cleanup: Cleanup): Disposable
  invalidate(): void
}
```

---

## 29. 架构决策摘要

本方案作出以下核心决策：

1. 保留 Three.js 原生对象，不建立平行对象体系。
2. 使用轻量微内核管理运行时公共流程。
3. 使用 Feature 作为代码组织和复用单位。
4. 使用 Context 提供有作用域的运行时能力。
5. 使用显式 ServiceKey 管理跨 Feature 依赖。
6. 使用 CleanupStack 确保回调、监听和资源能够释放。
7. 严格区分场景对象所有权与 GPU 资源所有权。
8. AssetManager 使用 Handle 和引用计数管理共享资产。
9. 同时支持连续渲染和按需渲染。
10. 复杂需求允许直接使用 Three.js，不强制声明式配置。
11. 核心不依赖 Vue、React 或其他 UI 框架。
12. 第一版优先保证规则清晰和行为正确，不追求功能数量。

最终希望达到的使用体验是：

> 初学者只需理解 App、Feature 和 Context，就能构建结构清晰的场景；高级用户仍然可以直接使用完整的 Three.js 能力；随着项目增长，资源、依赖和生命周期依然可追踪、可测试、可维护。

---

## 30. 规范级约定

从本章开始使用以下规范词：

- **必须**：实现不可违反，否则视为缺陷。
- **禁止**：实现不可执行该行为。
- **应当**：除非存在明确且记录在案的理由，否则应遵守。
- **可以**：属于可选能力，不影响核心兼容性。

当本文前后描述存在歧义时，后续章节中的规范级约定优先。

### 30.1 第一版能力边界

第一版正式支持：

- 单个 HTML Canvas。
- 主线程浏览器环境。
- 一个 App 对应一个 Renderer 和一个 Scene。
- 当前激活 Camera 可替换。
- WebGLRenderer。
- 连续渲染和按需渲染。
- 启动前静态注册 Feature。
- Pointer Events 下的鼠标与单指交互。

第一版明确不支持：

- App 启动后的 Feature 安装或卸载。
- WebXR。
- WebGPURenderer。
- OffscreenCanvas 和 Worker 渲染。
- 多 Canvas 共享一个 App。
- 服务热替换。
- 多指手势识别。

“不支持”意味着检测到相关用法时应尽早抛出错误，而不是静默产生不确定行为。内部设计不得主动阻碍未来扩展，但第一版不为未支持能力承诺兼容性。

### 30.2 标识与相等性

- Feature 使用 `name` 判断唯一性。
- Service 使用 `ServiceKey.id` 判断唯一性。
- Asset 使用规范化后的 `AssetKey` 判断唯一性。
- 场景对象使用对象引用判断所有权。
- 回调注册使用内部生成的唯一 Task ID。
- 不依赖对象名称、UUID 或 URL 原字符串代替上述身份规则。

---

## 31. Feature 依赖图完整契约

### 31.1 Feature 描述

```ts
export interface ThreeFeature {
  readonly name: string
  readonly provides?: readonly ServiceKey<unknown>[]
  readonly dependencies?: readonly ServiceKey<unknown>[]
  readonly optionalDependencies?: readonly ServiceKey<unknown>[]

  setup(context: ThreeContext): void | Promise<void>
}
```

含义：

- `provides`：Feature 承诺在 `setup()` 成功前注册的服务。
- `dependencies`：缺失时禁止启动的必需服务。
- `optionalDependencies`：存在则注入，不存在也允许启动。
- `setup`：Feature 唯一初始化入口。

### 31.2 图构建

设 Feature B 依赖服务 S，Feature A 声明提供 S，则建立边：

```text
A → B
```

必须满足：

1. 一个 ServiceKey 最多有一个提供者。
2. Feature 不能同时把同一服务列入必需依赖和可选依赖。
3. Feature 可以依赖自己提供的服务，但该自依赖没有意义并应视为配置错误。
4. 每个必需依赖必须存在提供者。
5. 可选依赖存在提供者时也建立排序边。
6. 图必须无环。

### 31.3 稳定拓扑排序

多个合法安装顺序同时存在时，使用注册顺序作为稳定排序依据。

例如：

```text
注册顺序：C, A, B
依赖关系：A → B
```

合法结果：

```text
C, A, B
```

不允许每次启动得到不同顺序。

### 31.4 循环依赖错误

循环依赖错误必须输出完整路径：

```text
Feature dependency cycle:
selection
  → camera-control via CameraControlService
  → inspection via InspectionService
  → selection via SelectionService
```

禁止尝试通过延迟注入、返回 `undefined` 或调整注册顺序绕过循环。应拆分服务或引入更低层的协调 Feature。

### 31.5 声明与实际注册一致性

Feature `setup()` 成功前，运行时必须检查：

- `provides` 中每个服务都已注册。
- Feature 没有注册未在 `provides` 中声明的公共服务。
- 服务没有被其他 Feature 注册。

未声明的私有对象不进入 ServiceContainer，不受该规则影响。

### 31.6 动态 Feature 决策

第一版中：

- `app.use()` 只允许在 `created` 状态调用。
- `starting` 后 FeatureRegistry 被锁定。
- 不提供 `removeFeature()`、`enableFeature()` 或 `disableFeature()`。
- Feature 内部可以暂停自己的任务，但这不改变依赖图。

未来若增加动态 Feature，必须另行设计事务式安装、依赖引用和卸载阻塞；不能直接放宽 `use()` 的状态限制。

---

## 32. App 并发与状态机完整契约

### 32.1 状态转换

```text
created ──start──▶ starting ──success──▶ running
   │                   │                    │
   │                   ├──failure──▶ failed│
   │                   │                    ├──pause──▶ paused
   │                   │                    │             │
   │                   │                    │◀──resume─────┘
   │                   │                    │
   └────dispose────────┴────────────────────┴──dispose──▶ disposing
                                                             │
                                                             ▼
                                                          disposed
```

`failed` 也允许进入 `disposing`，最终进入 `disposed`。

### 32.2 方法状态矩阵

- `use()`：仅 `created` 合法。
- `start()`：仅第一次在 `created` 合法；并发调用返回同一个 Promise。
- `pause()`：仅 `running` 生效；`paused` 时幂等。
- `resume()`：仅 `paused` 生效；`running` 时幂等。
- `render()`：仅 `running` 或 `paused` 合法。
- `setCamera()`：`created`、`starting`、`running`、`paused` 合法。
- `dispose()`：所有非 `disposed` 状态合法；并发调用返回同一个 Promise。

非法操作必须抛出 `AppStateError`，不得静默忽略，明确标记为幂等的方法除外。

### 32.3 操作串行化

App 内部必须串行执行 `start` 和 `dispose`：

- `start()` 创建 App 级 `AbortController`。
- `dispose()` 在 `starting` 期间调用时，先触发 abort。
- 启动流程在每个异步边界后检查 signal。
- 不再启动尚未执行的 Feature。
- 等待当前 `setup()` 结束或响应 abort。
- 清理当前 Feature 的部分 Scope。
- 反向清理已经启动成功的 Feature。
- 最后释放 App 自有基础设施。

`dispose()` 禁止无限等待不响应 abort 的用户 Promise。可以提供诊断超时，但不能在超时后假装资源已安全释放：

```ts
disposeTimeout?: number
```

超时后状态进入 `failed`，错误中列出未完成的 Feature。是否强制继续清理由调用方策略决定，默认继续释放能够安全释放的部分。

### 32.4 Setup 期间注册行为

- `setup()` 开始时 Feature Scope 进入 `initializing`。
- 初始化期间可以注册 cleanup、任务、输入和服务。
- 初始化失败或被取消时 Scope 进入 `disposing`。
- `disposing` 后禁止再注册任何内容。
- 异步回调晚到时尝试注册必须抛出 `DisposedScopeError`。
- Scope 最终状态只能是 `active`、`disposed` 或 `failed`。

### 32.5 RAF 所有权

- App 同一时间最多存在一个待执行 RAF。
- `pause()` 必须取消待执行 RAF。
- `dispose()` 必须取消 RAF，并阻止帧函数再次调度。
- 按需模式在无失效请求时不能保留 RAF。
- 连续模式每帧结束后、确认 App 仍为 `running` 时才调度下一帧。

---

## 33. Service 生命周期完整契约

### 33.1 作用域和所有权

第一版只有 App 级可见性，但服务所有权属于提供它的 Feature：

- 提供者初始化成功后服务变为可用。
- 消费者只能在自己的 `setup()` 及后续作用域中使用服务。
- 销毁顺序由依赖图反向顺序保证：消费者先销毁，提供者后销毁。
- 提供者销毁时服务从容器注销并标记失效。

### 33.2 服务释放

如果服务实现 `Disposable` 或 `AsyncDisposable`，`ctx.provide()` 应允许声明释放策略：

```ts
ctx.provide(ServiceKey, service, {
  dispose: 'auto',
})
```

规则：

- `auto`：提供者 Scope 自动释放服务。
- `manual`：Feature 自己通过 cleanup 释放。
- 默认 `auto`。
- 同一对象同时作为多个服务提供时，只能有一个自动释放所有者。

### 33.3 服务引用

消费者可以缓存服务引用，因为反向销毁保证提供者生命周期覆盖消费者。

禁止：

- 在 App 外部长期保存服务后于 App 销毁继续调用。
- 服务把自己的可变内部容器直接暴露给消费者。
- 通过 ServiceContainer 在运行时覆盖服务。

开发模式可以使用失效代理检测 dispose 后调用；生产模式不要求代理开销。

### 33.4 可选服务

可选服务只能通过：

```ts
ctx.injectOptional(ServiceKey)
```

获取。对未声明于 `dependencies` 或 `optionalDependencies` 的服务调用 `inject`，开发模式必须报错，以保持依赖透明。

---

## 34. AssetManager 精确状态机

### 34.1 CacheEntry 状态

```ts
type AssetEntryState =
  | 'loading'
  | 'ready'
  | 'release-pending'
  | 'disposing'
  | 'disposed'
  | 'failed'
```

转换：

```text
loading ──success──▶ ready
loading ──failure──▶ failed
ready ──refs=0──▶ release-pending
release-pending ──acquire──▶ ready
release-pending ──timeout/clear──▶ disposing ──▶ disposed
failed ──evict──▶ disposed
```

失败条目默认立即从活动缓存删除，下一次 acquire 允许重试。为防止故障请求风暴，可以配置短暂失败退避，但不能永久缓存错误。

### 34.2 Acquire 事务

调用 `acquire(key)` 时：

1. 规范化 AssetKey。
2. 如果存在 `ready` 条目，增加引用并返回新 Handle。
3. 如果存在 `release-pending` 条目，取消释放计时、增加引用并返回新 Handle。
4. 如果存在 `loading` 条目，订阅同一个加载任务。
5. 如果不存在，创建 `loading` 条目并启动 Loader。
6. 每个成功调用返回独立 Handle。

等待同一加载任务的每个调用者拥有独立 AbortSignal：

- 一个调用者 abort，只取消该调用者的等待和预留引用。
- 其他调用者不受影响。
- 当所有等待者都 abort 且 Loader 支持取消时，取消底层加载。
- Loader 不支持取消时允许加载完成，但结果在无引用时立即进入释放流程。

### 34.3 Handle 状态

```ts
type AssetHandleState = 'active' | 'released'
```

规则：

- Handle 创建时必须对应且只对应一个引用。
- `dispose()` 将 `active` 转为 `released`。
- 生产模式重复 `dispose()` 幂等。
- 开发模式重复释放记录警告和创建堆栈。
- `released` 后访问 `value` 应抛出 `ReleasedAssetHandleError`。
- Handle 不允许恢复为 active。

### 34.4 Pin 与预加载

预加载不应伪造永久引用：

```ts
const pin = await assets.preload(key)
pin.dispose()
```

Pin 本质上也是引用句柄，但不暴露业务资产值。应用销毁时所有 Pin 都必须释放。

### 34.5 AssetKey 规范化

必须包括：

- Loader 类型。
- 基于 `document.baseURI` 解析后的绝对 URL。
- 会影响加载结果的参数。
- 资源变体。

不得包括：

- AbortSignal。
- 进度回调。
- 日志回调。
- 不影响结果的调用方元数据。

参数必须使用稳定序列化；禁止直接对普通对象使用不稳定的 `JSON.stringify` 作为长期缓存协议。

### 34.6 GLTF 资产与实例

GLTF AssetHandle 持有源资产及其共享 GPU 资源。每个实例必须持有父资产引用：

```ts
interface GltfInstance extends Disposable {
  readonly root: THREE.Object3D
}
```

实例规则：

- `clone` 和 `skeleton-clone` 默认共享 Geometry、Material、Texture。
- 实例 dispose 时只从父节点移除并释放其父资产引用。
- 实例禁止 dispose 共享 GPU 资源。
- 如果调用方需要修改 Material，必须显式请求 `materials: 'clone'`。
- 克隆的 Material 归实例所有，实例 dispose 时释放。
- 克隆 Material 默认仍共享 Texture；如需独立 Texture 必须单独声明。
- `shared` 模式同一时间只能有一个活动实例。

建议 API：

```ts
const gltf = await ctx.assets.acquireGLTF(url)
ctx.retain(gltf)

const instance = gltf.instantiate({
  skeleton: 'auto',
  materials: 'shared',
  textures: 'shared',
})

ctx.addCleanup(instance)
```

### 34.7 App 销毁

App 销毁 AssetManager 时：

1. 拒绝新的 acquire。
2. Abort 可取消的加载。
3. 等待加载任务结算或达到诊断超时。
4. 将所有 Handle 标记失效。
5. 取消延迟释放计时器。
6. 释放全部 App 自有缓存资源。
7. 汇总释放错误。

仍存在活动 Handle 属于生命周期缺陷，开发模式必须报告来源；但不能因此跳过整体清理。

### 34.8 外部手动 dispose

共享资产交给 AssetManager 后，调用方禁止直接调用其 GPU 资源的 `dispose()`。运行时无法可靠检测所有外部手动释放，只能在开发文档和部分包装 API 中检查。

---

## 35. WebGL Context 丢失与恢复

### 35.1 状态

App 增加运行时标记：

```ts
type GraphicsState = 'available' | 'lost' | 'restoring' | 'unavailable'
```

该状态与 AppState 正交，不应为了 Context 丢失创建大量组合状态。

### 35.2 Context Lost

Canvas 必须监听：

```ts
webglcontextlost
webglcontextrestored
```

收到 `webglcontextlost` 时：

1. 调用 `event.preventDefault()` 请求浏览器允许恢复。
2. 将 GraphicsState 设为 `lost`。
3. 暂停渲染和固定更新。
4. 保留 App 原先是 running 还是 paused 的状态。
5. 通知诊断系统。
6. 调用已注册的 `onContextLost` 回调。

普通业务 update 默认也暂停，避免仿真在不可见期间大幅前进。需要持续运行的非图形任务不应注册在 Three Runtime 的帧 Scheduler 中。

### 35.3 Context Restored

收到恢复事件时：

1. GraphicsState 设为 `restoring`。
2. 重新应用 Renderer 配置。
3. 通知 RenderPipeline 重建 RenderTarget 和 Pass。
4. 调用 Feature 的 `onContextRestored`。
5. 执行一次尺寸同步。
6. 请求一次完整渲染。
7. 成功后设为 `available`。
8. 如果丢失前为 running，恢复循环；原先 paused 则保持 paused。

Three.js 会尝试重建其管理的资源，但以下自定义资源必须由创建者负责恢复：

- 直接操作 WebGL context 创建的资源。
- 自定义 framebuffer。
- 第三方后处理内部资源。
- GPU 计算资源。
- 不受 Three.js 管理的扩展对象。

### 35.4 Feature 恢复 API

```ts
ctx.onContextLost(callback)
ctx.onContextRestored(async () => {})
```

回调自动绑定 Feature Scope。恢复顺序遵循 Feature 安装顺序，失败时：

- GraphicsState 进入 `unavailable`。
- App 不恢复渲染。
- 抛出包含 Feature 名称的恢复错误。
- 调用方仍可以 `dispose()`。

第一版不承诺从所有第三方渲染扩展中自动恢复。

---

## 36. RenderPipeline 与渲染扩展契约

### 36.1 唯一主 Pipeline

App 始终恰好有一个主 Pipeline：

```ts
interface RenderPipeline {
  readonly name: string
  setSize(size: RenderSize): void
  render(context: RenderContext): void
  restore?(): void | Promise<void>
  dispose(): void | Promise<void>
}
```

未安装自定义 Pipeline 时使用 `DirectRenderPipeline`。

### 36.2 Pipeline 所有权

- 自定义 Pipeline 必须由声明 `RenderPipelineService` 的 Feature 提供。
- 同时存在多个提供者在依赖图验证阶段报错。
- Pipeline 生命周期归提供 Feature。
- Feature 销毁前恢复默认 Pipeline，再释放自定义 Pipeline。
- App 销毁时按 Feature 反向顺序自然完成该过程。

### 36.3 RenderStage

不需要替换主 Pipeline 的 Feature 可以注册渲染阶段：

```ts
type RenderStageName =
  | 'before-main-render'
  | 'after-main-render'
  | 'overlay'
```

```ts
ctx.rendering.addStage({
  name: 'labels-overlay',
  stage: 'overlay',
  priority: 0,
  render(context) {},
})
```

规则：

- 同阶段按 priority 和注册顺序稳定排序。
- Stage 不得调用主 Pipeline 的 `render()`。
- Stage 必须自行恢复其修改的 Renderer state，或使用框架提供的 state guard。
- Stage 自动绑定 Feature Scope。

### 36.4 多 Pass 后处理

后处理由一个 Composer Pipeline 统一拥有。其他 Feature 不直接获取 EffectComposer 并随意修改，而是向后处理服务注册 Pass：

```ts
postprocessing.addPass(pass, {
  id: 'outline',
  priority: 100,
})
```

Pass ID 必须唯一，销毁绑定注册 Feature。这样避免多个 Feature 争夺主 Pipeline。

### 36.5 临时渲染

截图、对象拾取和缩略图属于显式临时渲染任务：

```ts
await ctx.rendering.withRendererState(async renderer => {
  // 临时修改 render target、viewport 或 clear state
})
```

调用结束后必须恢复：

- Render target。
- Viewport 和 scissor。
- Clear color、alpha。
- Auto clear。
- XR enabled 状态。

临时任务不允许与主帧渲染并发执行，必须进入渲染操作队列。

---

## 37. 输入系统确定性契约

### 37.1 坐标计算

Pointer 坐标必须基于 `canvas.getBoundingClientRect()`：

```ts
x = ((clientX - rect.left) / rect.width) * 2 - 1
y = -((clientY - rect.top) / rect.height) * 2 + 1
```

这可以处理页面滚动和普通 CSS 缩放。第一版不保证对 Canvas 的旋转、倾斜或非二维仿射 CSS transform 正确；检测到复杂 transform 时开发模式应警告。

### 37.2 命中规则

- Raycaster 只检测注册的交互根对象。
- 默认 `recursive: true`。
- 交点按距离升序。
- 默认只向最近命中对象分发。
- `allIntersections: true` 可以启用穿透分发。
- 不可见对象遵循 Three.js Raycaster 的实际行为，并可通过过滤器进一步排除。
- Event 的 `object` 是实际命中的可射线对象。
- `currentTarget` 是当前正在处理监听器的注册对象。

### 37.3 Hover

InputManager 为每个 pointerId 保存当前传播路径。

Pointer move 时比较旧路径和新路径：

- 离开节点触发 `pointerleave`。
- 新进入节点触发 `pointerenter`。
- 保持命中的节点触发 `pointermove`。

对象注销、从场景移除或 Feature 销毁时，必须清除对应 Hover 状态。框架不必监听任意 Scene 树变化，但自身 `own()` 和输入注销路径必须正确处理；外部直接移除对象后应主动释放监听器。

### 37.4 Pointer Capture

事件对象提供：

```ts
event.setPointerCapture()
event.releasePointerCapture()
```

捕获后：

- 同 pointerId 的 move/up/cancel 发送到捕获对象。
- `pointerup` 或 `pointercancel` 后自动释放。
- 对象注销或 Scope 销毁时自动释放。
- DOM 层使用 Canvas 的原生 Pointer Capture 保证离开 Canvas 后仍能收到事件。

### 37.5 Click 与 Double Click

Click 需要同时满足：

- down 和 up 使用同一 pointerId。
- 移动距离小于 `clickMoveTolerance`，默认 4 CSS px。
- 持续时间小于 `clickDuration`，默认 500 ms。
- up 时命中目标与 down 目标兼容，或目标持有 capture。

双击使用浏览器 `dblclick` 语义。单击事件不会为了等待双击而延迟；如果业务要求单击和双击互斥，应由上层 Gesture Feature 实现。

### 37.6 多指边界

第一版接收所有 PointerEvent，但只提供独立 pointerId 的基础事件，不识别：

- Pinch。
- Rotate。
- 双指平移。

需要手势时使用独立 Gesture Feature，禁止把复杂手势状态塞入核心 InputManager。

### 37.7 DOM 协调

- 默认不调用 `preventDefault()`。
- Feature 可以在事件处理器中显式调用。
- 是否设置 `touch-action: none` 由 App 配置决定。
- InputManager 只监听 Canvas，不监听整个 document，Pointer Capture 期间除外。
- 所有 DOM Listener 必须在 App dispose 时移除。

---

## 38. Camera、Scene 与 Renderer 所有权补充

### 38.1 Ownership

所有核心对象创建时记录：

```ts
type Ownership = 'app' | 'external'
```

- 通过配置创建的对象为 `app`。
- 直接传入实例的对象默认为 `external`。
- 可以通过显式配置转移所有权。
- App 只 dispose 自有 Renderer。
- Scene 和 Camera 本身通常没有 `dispose()`，但其中资源仍按各自所有权管理。

### 38.2 Camera 替换事件

```ts
ctx.onCameraChanged(({ previous, current }) => {})
```

替换 Camera 时：

1. 验证 Camera 未被销毁且属于同一运行上下文。
2. 更新 activeCamera。
3. 通知 ResizeController。
4. 通知 RenderPipeline。
5. 通知相关 Feature。
6. `invalidate()`。

Camera Feature 不应缓存 `ctx.camera`；如果需要长期引用，应监听变化或每次通过 getter 获取。

### 38.3 Renderer 替换

第一版禁止运行时替换 Renderer。Renderer 与 Canvas、Context、Pipeline、资产 GPU 状态深度绑定，替换应通过销毁并创建新 App 完成。

### 38.4 Scene 替换

第一版禁止替换主 Scene。多场景渲染可以由自定义 Pipeline 管理额外 Scene，但 `ctx.scene` 始终指向主 Scene。

---

## 39. 平台、兼容性与构建约定

### 39.1 运行环境

核心包导入时不得访问：

- `window`。
- `document`。
- WebGL context。

这些能力只能在 `createThreeApp()` 或显式浏览器适配函数执行时访问。这样允许 Node 环境导入类型、运行非浏览器单元测试和执行构建工具。

但第一版实际运行 ThreeApp 仍要求浏览器主线程。

### 39.2 浏览器基线

发布前必须明确浏览器支持矩阵，至少验证：

- 最新两个稳定版本的 Chrome。
- 最新两个稳定版本的 Edge。
- 最新两个稳定版本的 Firefox。
- 当前和前一个主版本 Safari。

是否支持 WebGL1 取决于所选 Three.js 版本。若 Three.js 基线要求 WebGL2，本库不得声称兼容 WebGL1。

### 39.3 Three.js 兼容

- `three` 必须是 peer dependency。
- 每个发布版本必须声明测试过的 Three.js 修订范围。
- CI 至少测试最低支持版本和最高支持版本。
- 不以类型编译成功代替运行时兼容测试。
- 依赖 Three.js 私有字段的实现必须隔离并有版本测试。

### 39.4 颜色、单位和坐标约定

默认约定：

- 世界长度单位由业务决定，推荐统一为米。
- 时间统一使用秒。
- 角度 API 若直接映射 Three.js 则使用弧度。
- 使用 Three.js 默认右手坐标系。
- Y 轴向上。
- 颜色空间遵循当前受支持 Three.js 版本的推荐设置。
- 颜色纹理标记为 sRGB，数据纹理保持无颜色空间。

运行时不自动缩放或旋转导入模型。模型单位和朝向转换属于资产管线或业务 Feature。

### 39.5 CORS 与 URL

AssetManager 不绕过浏览器 CORS：

- 跨域资源必须由服务器提供正确响应头。
- URL 规范化不得移除签名查询参数。
- 缓存键不得记录 Authorization Header 明文。
- Loader 认证信息由明确的 Request Policy 提供。

### 39.6 打包

建议：

- ESM 优先。
- 保留 TypeScript 声明。
- `sideEffects: false`，仅在实际满足时声明。
- Three.js 和可选 examples 依赖不重复打包。
- 不在模块顶层创建单例。
- 开发诊断代码支持构建时裁剪。

---

## 40. 性能与内存验收基线

核心运行时发布前必须建立可重复基准，而不是只做主观判断。

### 40.1 空场景开销

对比直接 Three.js 空循环，记录：

- 每帧 CPU 中位数和 P95。
- 运行时自身分配量。
- 100、1,000、10,000 个空 update 任务的调度成本。

不规定脱离设备的绝对毫秒数，但同一基准环境中必须设置回归阈值。

### 40.2 内存泄漏验收

循环执行至少 20 次：

```text
create app
→ start
→ load representative assets
→ interact
→ dispose
```

检查：

- RAF 数量回到零。
- DOM Listener 回到基线。
- ResizeObserver 被断开。
- Scheduler 任务为零。
- Input 注册为零。
- Asset 引用为零。
- `renderer.info.memory` 在允许缓存清空后回到稳定区间。
- JS Heap 在 GC 后不随循环线性增长。

### 40.3 大场景边界

核心只保证不会引入不必要的全 Scene 每帧遍历。以下能力属于业务或扩展：

- LOD 策略。
- InstancedMesh 管理。
- BVH。
- Occlusion culling。
- Streaming。
- 分块加载。

可以提供独立 Feature，但不进入最小内核。

---

## 41. 测试矩阵补充

### 41.1 Feature 图

必须测试：

- 缺失服务。
- 重复服务提供者。
- 自依赖。
- 两节点和多节点循环。
- 可选依赖存在和缺失。
- 稳定拓扑排序。
- 声明服务但 setup 未提供。
- setup 提供未声明服务。

### 41.2 并发状态

必须测试：

- 两次并发 `start()`。
- 两次并发 `dispose()`。
- `starting` 中 dispose。
- `setup()` resolve 与 abort 同时发生。
- 帧回调内 dispose。
- before-render 中 pause。
- Context lost 后立即 dispose。
- Context restoring 中 dispose。

### 41.3 渲染

必须测试：

- Camera 替换触发 Resize 和 invalidate。
- Pipeline resize。
- RenderStage 顺序。
- 临时渲染后 Renderer state 恢复。
- 按需模式失效合并。
- 暂停时手动 `render()`。

### 41.4 输入

必须测试：

- Canvas 非零页面偏移。
- CSS 缩放。
- Pointer 离开 Canvas。
- Pointer capture。
- 对象重叠。
- 事件冒泡和停止传播。
- 对象注销时 hover leave。
- Feature dispose 后无事件。

### 41.5 资源

除前文测试外，还必须覆盖：

- release-pending 时重新 acquire。
- 所有等待者 abort。
- 部分等待者 abort。
- Loader 成功与最后一个 abort 竞态。
- GLTF 实例保持父资产引用。
- 独立 Material 与共享 Texture 的释放。
- AssetManager dispose 时仍有活动 Handle。

---

## 42. API 演进与版本策略

### 42.1 语义化版本

- 修改公共类型、生命周期顺序或默认所有权属于破坏性变更。
- 增加可选字段通常属于次版本。
- 修复不符合本文“必须”规则的行为属于补丁版本，但如果用户可能依赖错误行为，需要迁移说明。

### 42.2 弃用

公共 API 弃用必须：

1. 在类型声明中使用 `@deprecated`。
2. 提供替代 API。
3. 开发模式给出一次性警告。
4. 至少保留一个次版本周期。
5. 在下一个主版本删除。

### 42.3 实验性能力

实验性 API：

- 不从稳定根入口导出。
- 名称和文档明确标记 experimental。
- 可以在次版本中发生破坏性变化。
- 不得被核心稳定 API 依赖。

---

## 43. 完整实施顺序修订

为避免先实现表层 API、后补底层语义，实施顺序调整为：

1. 定义 AppState、FeatureScopeState、GraphicsState 和 AssetEntryState。
2. 实现 Disposable、CleanupStack 和错误聚合。
3. 实现 ServiceKey、Feature 元数据验证和稳定拓扑排序。
4. 实现 App 操作串行化、Abort 和回滚。
5. 实现 Scheduler、RAF、暂停和按需失效。
6. 实现 Renderer、Camera、Resize 与所有权。
7. 实现 AssetManager 状态机、Handle 和 Loader。
8. 实现 GLTF 实例所有权。
9. 实现 InputManager。
10. 实现 RenderPipeline 和 RenderStage。
11. 实现 Context lost/restored。
12. 实现诊断与 Inspector。
13. 实现通用 Feature。
14. 建立浏览器、性能和内存基准。
15. 冻结第一版公共 API。

每一步必须先通过对应单元测试，再向下一层集成。

---

## 44. 第一版完成定义

满足以下所有条件后，才能称为“完整的第一版”：

- 所有公开接口有类型声明和行为文档。
- Feature 图在 setup 前完成验证。
- 安装和销毁顺序确定且可测试。
- `start()` 与 `dispose()` 竞态行为确定。
- 所有自动注册项都绑定明确 Scope。
- AssetHandle 和 CacheEntry 状态机实现完整。
- GLTF 共享资源不会提前释放。
- 外部资源不会被运行时误释放。
- 连续和按需渲染均无重复 RAF。
- Resize、Camera 替换和 Pipeline 尺寸同步正确。
- Context lost/restored 有明确退化和失败行为。
- 输入事件命中、传播、捕获和清理规则确定。
- App dispose 后没有 RAF、Listener、Observer、Task 和活动缓存。
- 核心导入不产生浏览器副作用。
- 支持的 Three.js 和浏览器范围经过 CI 验证。
- 示例覆盖基础组合、资产、输入、后处理、失败回滚和销毁。
- 性能与内存基准没有超过项目设定的回归阈值。
- 核心不依赖 Vue、React 或其他 UI 框架。

至此，方案不仅定义“有哪些模块”，还定义了模块在成功、失败、取消、并发、恢复和销毁情况下的确定行为，可以作为实现、测试和代码评审的共同契约。
