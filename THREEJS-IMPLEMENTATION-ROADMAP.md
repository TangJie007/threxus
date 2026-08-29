# Three.js 轻量运行时实施路线

## 1. 文档目的

本文档将 `THREEJS-ENCAPSULATION-DESIGN.md` 转化为可执行的开发计划。

核心目标不是尽快显示复杂模型，而是先证明：

> 任意 Feature 在成功、失败、取消和销毁情况下，都不会遗留资源、回调或运行任务。

实施主线：

```text
生命周期
  → Feature 依赖
  → App 状态机
  → 渲染循环
  → Renderer/Camera/Resize
  → 资产所有权
  → 输入交互
  → 渲染扩展
  → Context 恢复
  → 通用 Feature
  → 稳定发布
```

本阶段不实现 Vue、React 或其他 UI 框架适配。

---

## 2. 实施原则

### 2.1 先定义契约，再编写实现

每个模块按以下顺序开发：

1. 定义公共类型。
2. 定义状态和状态转换。
3. 明确错误行为。
4. 编写单元测试。
5. 编写最小实现。
6. 编写集成测试。
7. 编写最小示例。
8. 检查资源清理。

### 2.2 不允许跨阶段偷跑

例如：

- 生命周期未稳定前，不实现 GLTF 缓存。
- App 状态机未稳定前，不实现动态 Feature。
- AssetHandle 未稳定前，不实现复杂模型实例化。
- InputManager 未稳定前，不实现 Selection Feature。
- RenderPipeline 未稳定前，不实现后处理 Feature。

### 2.3 每阶段必须可独立验收

每个阶段结束时，代码必须：

- 可以构建。
- 类型检查通过。
- 测试通过。
- 不依赖下一阶段的临时实现。
- 有明确的完成定义。

---

## 3. 阶段总览

```text
M0  项目基础与测试环境
M1  Disposable 与结构化清理
M2  Feature、Service 与依赖图
M3  ThreeApp 状态机和异步回滚
M4  Scheduler 与渲染循环
M5  Renderer、Camera、Resize
M6  AssetManager 与资源所有权
M7  GLTF 实例管理
M8  InputManager 与射线交互
M9  RenderPipeline 与渲染扩展
M10 WebGL Context 恢复
M11 通用 Feature
M12 诊断、性能与发布稳定
```

其中：

- M0–M5 构成最小可用运行时。
- M6–M7 构成可靠资产系统。
- M8–M10 构成交互与渲染扩展能力。
- M11–M12 构成可发布产品。

---

## 4. M0：项目基础与测试环境

### 4.1 目标

建立不会影响后续架构决策的基础设施。

### 4.2 工作项

- 确定 TypeScript 严格模式。
- 配置 ESM 构建。
- 将 `three` 设为 peer dependency。
- 配置单元测试环境。
- 配置浏览器集成测试环境。
- 配置类型测试。
- 建立公开 API 入口。
- 建立内部模块目录。

推荐初始目录：

```text
src/
  app/
  feature/
  lifecycle/
  services/
  scheduler/
  rendering/
  assets/
  input/
  diagnostics/
  index.ts

tests/
  unit/
  integration/
  browser/

examples/
  basic/
```

### 4.3 初始编译约束

建议启用：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "isolatedModules": true
  }
}
```

具体配置应根据构建工具调整，但不得关闭严格模式来规避类型设计问题。

### 4.4 验收条件

- 可以从根入口导入一个占位类型。
- 单元测试和浏览器测试都可以运行。
- 打包结果不包含第二份 Three.js。
- 导入核心包不会访问 `window` 或创建 WebGL context。

---

## 5. M1：Disposable 与结构化清理

### 5.1 目标

建立所有后续模块共同依赖的资源清理基础。

### 5.2 首批类型

```ts
export interface Disposable {
  dispose(): void | Promise<void>
}

export type Cleanup =
  | (() => void | Promise<void>)
  | Disposable
```

实现：

```text
lifecycle/
  Disposable.ts
  CleanupStack.ts
  AggregateDisposeError.ts
```

### 5.3 CleanupStack 契约

- 后进先出执行。
- `dispose()` 幂等。
- 一个清理项失败不阻止其他清理项。
- 所有错误使用 `AggregateError` 汇总。
- 开始销毁后禁止继续注册。
- 支持同步和异步清理项。
- 清理完成后释放内部引用。

### 5.4 必测场景

- 空栈销毁。
- 单个同步清理。
- 多个清理项反向执行。
- 异步清理。
- 同步异常。
- 异步异常。
- 多个异常汇总。
- 重复 dispose。
- disposing 期间注册。
- disposed 后注册。

### 5.5 验收示例

```ts
const order: string[] = []
const stack = new CleanupStack()

stack.add(() => order.push('A'))
stack.add(() => order.push('B'))

await stack.dispose()

expect(order).toEqual(['B', 'A'])
```

### 5.6 完成定义

- CleanupStack 的状态转换不可逆。
- 错误情况下仍执行全部清理项。
- 其他模块不需要重复实现自己的清理容器。

---

## 6. M2：Feature、Service 与依赖图

### 6.1 目标

实现 Feature 的静态描述、服务注册和确定性安装顺序。

### 6.2 模块

```text
feature/
  ThreeFeature.ts
  FeatureRegistry.ts
  FeatureGraph.ts
  FeatureScope.ts
  FeatureErrors.ts

services/
  ServiceKey.ts
  ServiceContainer.ts
  ServiceErrors.ts
```

### 6.3 Feature 类型

```ts
export interface ThreeFeature {
  readonly name: string
  readonly provides?: readonly ServiceKey<unknown>[]
  readonly dependencies?: readonly ServiceKey<unknown>[]
  readonly optionalDependencies?: readonly ServiceKey<unknown>[]

  setup(context: ThreeContext): void | Promise<void>
}
```

### 6.4 ServiceKey

```ts
export interface ServiceKey<T> {
  readonly id: symbol
  readonly description: string
}

export function createServiceKey<T>(
  description: string,
): ServiceKey<T>
```

### 6.5 依赖图实现顺序

1. 校验 Feature 名称。
2. 建立 `ServiceKey → Feature` 提供者索引。
3. 检测重复服务提供者。
4. 检测缺失必需依赖。
5. 建立 Feature 有向图。
6. 检测自依赖。
7. 检测循环依赖。
8. 执行稳定拓扑排序。

无依赖关系时必须保持注册顺序。

### 6.6 必测场景

- 重复 Feature 名称。
- 重复服务提供者。
- 缺失依赖。
- 可选依赖缺失。
- 可选依赖存在。
- Feature 自依赖。
- 两节点循环。
- 多节点循环。
- 多个合法顺序下保持稳定。
- 声明 provides 但未实际 provide。
- 实际 provide 但未声明。

### 6.7 FeatureScope

第一阶段只实现作用域状态和 CleanupStack：

```ts
type FeatureScopeState =
  | 'initializing'
  | 'active'
  | 'disposing'
  | 'disposed'
  | 'failed'
```

FeatureScope 负责：

- 保存 Feature 元数据。
- 保存 AbortController。
- 保存 CleanupStack。
- 记录提供的服务。
- 拒绝在 disposing/disposed 后注册。

### 6.8 完成定义

- 给定 Feature 列表，安装顺序完全确定。
- 所有依赖错误在执行 setup 前发现。
- 循环错误包含完整依赖路径。
- Service 随提供者 Scope 释放。

---

## 7. M3：ThreeApp 状态机与异步回滚

### 7.1 目标

建立应用启动、失败、取消和销毁的确定行为。

### 7.2 模块

```text
app/
  ThreeApp.ts
  ThreeAppImpl.ts
  AppState.ts
  AppOperationQueue.ts
  AppErrors.ts
  createThreeApp.ts
```

### 7.3 状态

```ts
type AppState =
  | 'created'
  | 'starting'
  | 'running'
  | 'paused'
  | 'disposing'
  | 'disposed'
  | 'failed'
```

### 7.4 首轮 ThreeContext

此阶段 Context 只提供：

```ts
interface ThreeContext {
  readonly signal: AbortSignal

  provide<T>(key: ServiceKey<T>, value: T): void
  inject<T>(key: ServiceKey<T>): T
  injectOptional<T>(key: ServiceKey<T>): T | undefined

  addCleanup(cleanup: Cleanup): Disposable
}
```

暂时不要加入资产、输入和渲染能力。

### 7.5 Start 流程

```text
lock registry
→ validate graph
→ create app AbortController
→ state = starting
→ setup features in graph order
→ verify declared services
→ activate scopes
→ state = running
```

### 7.6 失败回滚

Feature C 失败时：

```text
dispose partial scope C
→ dispose active scope B
→ dispose active scope A
→ dispose app infrastructure
→ state = failed
```

销毁顺序必须与成功 setup 顺序相反。

### 7.7 并发操作

必须处理：

- 两次并发 start 返回同一个 Promise。
- 两次并发 dispose 返回同一个 Promise。
- starting 期间 dispose 触发 abort。
- setup 完成与 abort 同时发生。
- failed 状态仍可 dispose。

### 7.8 必测场景

- 无 Feature 启动。
- 单 Feature 启动。
- 多 Feature 按依赖启动。
- 同步 setup 失败。
- 异步 setup 失败。
- setup 期间 abort。
- 部分 scope cleanup 失败。
- dispose 幂等。
- disposed 后调用 start。
- running 后调用 use。

### 7.9 完成定义

- Feature 生命周期在所有异常路径下都能闭合。
- App 不会停留在不确定的中间状态。
- 启动和销毁竞态有自动化测试。

---

## 8. M4：Scheduler 与渲染循环

### 8.1 目标

建立每帧更新、固定更新和渲染阶段。

### 8.2 模块

```text
scheduler/
  Scheduler.ts
  SchedulerTask.ts
  FrameInfo.ts
  FixedStepAccumulator.ts
  RafDriver.ts
```

### 8.3 开发顺序

1. 实现普通任务注册和 Disposable。
2. 实现 priority 稳定排序。
3. 实现任务失效和帧后压缩。
4. 实现 FrameInfo。
5. 实现 delta 限制。
6. 实现固定时间步。
7. 实现 RAF Driver。
8. 实现 pause/resume。
9. 实现按需 invalidate。

### 8.4 Context 增量

```ts
interface ThreeContext {
  onUpdate(
    callback: UpdateCallback,
    options?: TaskOptions,
  ): Disposable

  onFixedUpdate(
    callback: FixedUpdateCallback,
    options?: TaskOptions,
  ): Disposable

  onBeforeRender(
    callback: RenderCallback,
    options?: TaskOptions,
  ): Disposable

  onAfterRender(
    callback: RenderCallback,
    options?: TaskOptions,
  ): Disposable

  invalidate(): void
}
```

这些注册必须自动加入当前 FeatureScope。

### 8.5 关键规则

- 同一 App 最多一个待执行 RAF。
- 同 priority 保持注册顺序。
- 回调执行期间新增任务从下一帧开始。
- 回调执行期间删除任务立即阻止其后续执行。
- 单个任务异常遵循 App errorPolicy。
- pause 取消 RAF。
- on-demand 无失效时不调度 RAF。
- 多次 invalidate 合并为一帧。

### 8.6 必测场景

- Priority 顺序。
- 相同 Priority 稳定顺序。
- 执行中注册。
- 执行中注销。
- 回调内 dispose App。
- 超大 delta 截断。
- FixedStep 最大迭代限制。
- Pause/Resume。
- On-demand 失效合并。
- Dispose 后无 RAF。

### 8.7 完成定义

- 空应用不会重复创建 RAF。
- Feature 销毁后不再收到任何回调。
- 连续和按需模式均可独立验证。

---

## 9. M5：Renderer、Camera 与 Resize

### 9.1 目标

完成最小可用 Three.js 运行时。

### 9.2 模块

```text
rendering/
  RendererFactory.ts
  CameraFactory.ts
  ResizeController.ts
  PixelRatioController.ts
  DirectRenderPipeline.ts
  CoreObjectOwnership.ts
```

### 9.3 开发顺序

1. Scene 创建和外部 Scene 接入。
2. WebGLRenderer 创建和外部 Renderer 接入。
3. PerspectiveCamera 创建。
4. OrthographicCamera 创建。
5. 核心对象所有权记录。
6. DirectRenderPipeline。
7. ResizeObserver。
8. PixelRatio 限制。
9. Camera 替换。
10. Camera changed 事件。

### 9.4 所有权测试

分别验证：

- App 创建 Renderer 时，dispose 会释放 Renderer。
- 外部传入 Renderer 时，默认不释放。
- 显式转移所有权后会释放。
- Scene 中外部资源不会被递归误释放。

### 9.5 第一个完整示例

```ts
const app = createThreeApp({
  canvas,
  camera: {
    type: 'perspective',
    position: [3, 2, 5],
  },
})

app.use({
  name: 'rotating-box',

  setup(ctx) {
    const geometry = new THREE.BoxGeometry()
    const material = new THREE.MeshStandardMaterial()
    const mesh = new THREE.Mesh(geometry, material)

    ctx.scene.add(mesh)
    ctx.own(mesh)

    ctx.onUpdate(({ delta }) => {
      mesh.rotation.y += delta
    })

    ctx.addCleanup(() => geometry.dispose())
    ctx.addCleanup(() => material.dispose())
  },
})

await app.start()
```

### 9.6 必测场景

- Canvas 初始尺寸为零。
- Canvas 尺寸变化。
- DevicePixelRatio 上限。
- PerspectiveCamera aspect 更新。
- OrthographicCamera 投影更新。
- Camera 替换。
- 外部 Renderer 所有权。
- Pause 后手动 render。
- Dispose 后 ResizeObserver 断开。

### 9.7 M0–M5 总验收

至此必须达到：

- 可以构建基础 Three.js 场景。
- 可以组合多个 Feature。
- 初始化失败可以回滚。
- 可以暂停、恢复和按需渲染。
- Resize 和 Camera 正确。
- App 销毁后无 RAF、Listener、Observer 和 Scheduler Task。

没有达到这些条件前，不进入资产系统。

---

## 10. M6：AssetManager 与资源所有权

### 10.1 目标

实现共享资产的加载、缓存、引用和释放。

### 10.2 模块

```text
assets/
  AssetKey.ts
  AssetHandle.ts
  AssetCacheEntry.ts
  AssetManager.ts
  AssetLoader.ts
  AssetErrors.ts
  StableAssetKeySerializer.ts
```

### 10.3 实施顺序

1. AssetKey 规范化。
2. CacheEntry 状态机。
3. AssetHandle。
4. Loader 注册。
5. 单资源加载。
6. 并发请求合并。
7. 独立调用方 Abort。
8. 引用计数。
9. 延迟释放。
10. Failure eviction 和 retry。
11. preload/pin。
12. AssetManager dispose。

### 10.4 先使用假 Loader

不要一开始接入 GLTFLoader。先使用可控假 Loader 验证状态机：

```ts
const loader = createDeferredTestLoader()

const first = assets.acquire(key)
const second = assets.acquire(key)

loader.resolve(asset)

expect(loader.calls).toBe(1)
```

### 10.5 必测竞态

- 两个 acquire 同时发生。
- 一个等待者 abort。
- 所有等待者 abort。
- Abort 与 resolve 同时发生。
- Release-pending 时重新 acquire。
- Dispose 与加载完成同时发生。
- Loader 失败后重试。
- Handle 重复释放。
- Released Handle 访问 value。

### 10.6 首批真实 Loader

状态机稳定后实现：

- TextureAssetLoader。
- CubeTextureAssetLoader。
- 可选基础 FileAssetLoader。

不要先实现过多 Loader。

### 10.7 完成定义

- 同一 AssetKey 只产生一个底层加载任务。
- 每个 Handle 对应一个引用。
- 引用归零后按策略释放。
- App dispose 后没有活动 CacheEntry。
- 外部手动释放规则有明确文档和开发警告。

---

## 11. M7：GLTF 实例与共享 GPU 资源

### 11.1 目标

解决 GLTF 对象树不能直接多父级挂载，以及克隆后 GPU 资源共享的问题。

### 11.2 模块

```text
assets/gltf/
  GltfAsset.ts
  GltfInstance.ts
  GltfAssetLoader.ts
  GltfInstantiateOptions.ts
  GltfResourceOwnership.ts
```

### 11.3 实例策略

支持：

```ts
gltf.instantiate({
  skeleton: 'auto',
  materials: 'shared',
  textures: 'shared',
})
```

规则：

- 普通模型使用深层 Object3D clone。
- SkinnedMesh 使用 SkeletonUtils clone。
- Geometry 默认共享。
- Material 默认共享。
- Texture 默认共享。
- 实例保持父 Asset 引用。
- 独立 Material 由实例释放。
- 共享资源只由 AssetManager 释放。

### 11.4 必测场景

- 两个实例可添加到不同父节点。
- SkinnedMesh 骨骼互不串扰。
- 实例释放不会销毁共享 Geometry。
- 实例释放不会销毁共享 Material。
- 独立 Material 会随实例释放。
- 独立 Material 使用的共享 Texture 不会被误释放。
- Asset Handle 释放但 Instance 存在时资源仍有效。
- 最后一个 Instance 释放后资源进入释放流程。

### 11.5 完成定义

必须能够准确回答每个 GLTF 相关对象：

```text
谁创建？
谁持有？
是否共享？
谁释放？
何时释放？
```

---

## 12. M8：InputManager

### 12.1 目标

提供有作用域、可清理、命中规则确定的 3D Pointer 交互。

### 12.2 模块

```text
input/
  InputManager.ts
  ScopedInputManager.ts
  InteractiveObjectRegistry.ts
  PointerState.ts
  PointerDispatcher.ts
  ThreePointerEvent.ts
```

### 12.3 实施顺序

1. Canvas Pointer Listener。
2. 坐标转 NDC。
3. 交互对象注册表。
4. Raycast。
5. Click。
6. 事件冒泡。
7. stopPropagation。
8. Pointer enter/leave。
9. Pointer capture。
10. Scope 自动解绑。

### 12.4 第一阶段事件

优先实现：

```text
pointerdown
pointermove
pointerup
pointercancel
pointerenter
pointerleave
click
dblclick
```

不实现 Pinch、Rotate 等手势。

### 12.5 必测场景

- Canvas 有页面偏移。
- Canvas 使用普通 CSS 缩放。
- 两个对象重叠。
- 最近对象命中。
- 父级事件冒泡。
- stopPropagation。
- Pointer 离开 Canvas。
- Pointer capture。
- 对象注销时清除 Hover。
- Feature dispose 后无事件。

### 12.6 完成定义

- Raycast 不遍历无关 Scene 对象。
- DOM Listener 可以全部释放。
- Feature 不需要自行管理 Input Listener 生命周期。

---

## 13. M9：RenderPipeline 与渲染扩展

### 13.1 目标

支持后处理、Overlay 和临时渲染，同时保持唯一主渲染控制权。

### 13.2 模块

```text
rendering/
  RenderPipeline.ts
  DirectRenderPipeline.ts
  RenderStage.ts
  RenderingRegistry.ts
  RendererStateGuard.ts
  RenderOperationQueue.ts
```

### 13.3 实施顺序

1. 抽取 DirectRenderPipeline。
2. Pipeline ServiceKey。
3. 自定义 Pipeline 唯一性检查。
4. RenderStage 注册。
5. Stage 优先级。
6. RendererStateGuard。
7. 临时渲染队列。
8. 后处理 Pipeline 示例。

### 13.4 关键约束

- 同一时间只有一个主 Pipeline。
- 其他 Feature 通过 Stage 或后处理服务扩展。
- Feature 不得静默替换 Pipeline。
- Resize 必须同步到 Pipeline。
- Camera 替换必须同步到 Pipeline。
- 临时渲染结束后恢复 Renderer 状态。

### 13.5 必测场景

- Pipeline 重复提供。
- RenderStage 排序。
- Stage 自动解绑。
- Pipeline Resize。
- Camera 替换。
- 临时 RenderTarget 恢复。
- Stage 异常后的 Renderer 状态恢复。

---

## 14. M10：WebGL Context 丢失与恢复

### 14.1 目标

确保 GPU Context 丢失时应用不会继续错误运行，并具备明确恢复行为。

### 14.2 模块

```text
rendering/
  GraphicsState.ts
  WebGLContextController.ts
  ContextRestoreRegistry.ts
```

### 14.3 实施顺序

1. 监听 context lost/restored。
2. GraphicsState。
3. Lost 时暂停渲染。
4. Pipeline restore。
5. Feature restore callback。
6. Resize 和完整重绘。
7. 恢复失败处理。

### 14.4 必测场景

- Running 时 Context lost。
- Paused 时 Context lost。
- Lost 后恢复。
- Restoring 中 dispose。
- Pipeline restore 失败。
- Feature restore 失败。
- 恢复成功后 RAF 数量仍然唯一。

### 14.5 完成定义

- Context 丢失后不再渲染。
- 恢复顺序稳定。
- 恢复失败不会伪装成成功。
- 无论是否恢复，App 都仍可 dispose。

---

## 15. M11：通用 Feature

### 15.1 目标

用真实功能验证微内核，而不是把通用功能写回 ThreeApp。

### 15.2 实现顺序

建议依次实现：

1. Environment Feature。
2. OrbitControls Feature。
3. Selection Feature。
4. Highlight Feature。
5. Stats Feature。
6. Postprocessing Feature。

### 15.3 验证重点

Environment 验证：

- 场景对象所有权。
- Texture AssetHandle。
- Feature 清理。

OrbitControls 验证：

- Update 任务。
- DOM 事件释放。
- Camera 替换。
- On-demand invalidate。

Selection 验证：

- InputManager。
- Service 提供。
- 状态封装。

Highlight 验证：

- Feature dependencies。
- 可选后处理服务。
- Material 或 Pass 所有权。

Stats 验证：

- Runtime Inspector。
- 开发模式诊断。

Postprocessing 验证：

- 自定义 Pipeline。
- Pass 注册。
- Resize。
- Context restore。

### 15.4 禁止事项

- 不因为某个 Feature 使用方便，就把业务状态加入 ThreeContext。
- 不让 ThreeApp 增加 `select()`、`focus()`、`loadModel()` 等业务方法。
- 不允许通用 Feature 直接引用其他 Feature 的内部实例。

---

## 16. M12：诊断、性能与稳定发布

### 16.1 诊断能力

实现：

- Logger。
- Runtime Inspector。
- Feature 状态快照。
- Scheduler 任务统计。
- Asset cache 统计。
- Renderer info。
- 开发模式生命周期警告。

### 16.2 性能基准

至少建立：

- 空场景运行时开销。
- 100/1,000/10,000 Update Task。
- 100/1,000 个交互对象 Raycast。
- 相同资源并发 acquire。
- App 重复创建销毁。

### 16.3 内存验收

重复至少 20 次：

```text
create
→ start
→ load
→ interact
→ dispose
```

检查：

- RAF 为零。
- DOM Listener 回到基线。
- ResizeObserver 被断开。
- Scheduler Task 为零。
- Input 注册为零。
- Asset 引用为零。
- JS Heap 不线性增长。
- GPU 资源回到稳定区间。

### 16.4 浏览器矩阵

验证：

- Chrome。
- Edge。
- Firefox。
- Safari。
- 支持范围内最低和最高 Three.js 版本。

### 16.5 发布前示例

```text
01-basic-scene
02-feature-dependencies
03-start-failure-rollback
04-assets-and-disposal
05-gltf-instances
06-pointer-interaction
07-on-demand-rendering
08-postprocessing
09-context-restore
10-complete-disposal
```

---

## 17. 第一轮开发建议

第一次开发迭代只完成 M1–M3，不创建复杂场景。

### 17.1 建议任务拆分

任务 1：

```text
Disposable
CleanupStack
AggregateError
```

任务 2：

```text
ServiceKey
ServiceContainer
服务所有权
```

任务 3：

```text
FeatureRegistry
FeatureGraph
稳定拓扑排序
循环检测
```

任务 4：

```text
FeatureScope
AbortSignal
作用域状态
```

任务 5：

```text
ThreeApp 状态机
start
dispose
失败回滚
```

任务 6：

```text
并发和错误路径测试
```

### 17.2 第一轮不做

- WebGLRenderer。
- GLTFLoader。
- TextureLoader。
- Raycaster。
- OrbitControls。
- 后处理。
- 复杂示例。

第一轮可以使用假的 RuntimeContext 验证纯生命周期逻辑。

### 17.3 第一轮验收程序

```ts
const ServiceA = createServiceKey<{ value: number }>('service-a')

const app = createTestApp()

app.use({
  name: 'provider',
  provides: [ServiceA],

  setup(ctx) {
    ctx.provide(ServiceA, { value: 1 })
    ctx.addCleanup(() => record('provider disposed'))
  },
})

app.use({
  name: 'consumer',
  dependencies: [ServiceA],

  setup(ctx) {
    const service = ctx.inject(ServiceA)
    expect(service.value).toBe(1)
    ctx.addCleanup(() => record('consumer disposed'))
  },
})

await app.start()
await app.dispose()

expect(records).toEqual([
  'consumer disposed',
  'provider disposed',
])
```

---

## 18. 风险排序

### 高风险

- 异步 setup 与 dispose 竞态。
- Feature 依赖循环和销毁顺序。
- GLTF 克隆后的共享资源释放。
- Asset acquire/abort/release 竞态。
- Renderer 和外部资源所有权。
- Context restore。

这些模块必须先测试状态机，再实现功能。

### 中风险

- FixedStep 调度。
- On-demand RAF 合并。
- Pointer capture。
- 多 Feature 扩展 RenderPipeline。
- Camera 替换后的同步。

### 低风险

- 基础 Camera 配置。
- Environment Feature。
- Stats UI。
- 简单 Logger。

开发资源应优先投入高风险基础模块，而不是低风险可见功能。

---

## 19. Pull Request 拆分建议

每个 PR 应只引入一个可独立验证的概念：

```text
PR 01  lifecycle primitives
PR 02  typed service container
PR 03  feature graph
PR 04  feature scope
PR 05  app state machine
PR 06  scheduler
PR 07  renderer and resize
PR 08  asset state machine
PR 09  texture loaders
PR 10  glTF instances
PR 11  input manager
PR 12  render pipeline
PR 13  context restore
PR 14  common features
PR 15  diagnostics and benchmarks
```

不要在同一个 PR 中同时加入：

- 核心抽象。
- 大型业务示例。
- 与核心无关的格式化。
- 多个未完成模块。

---

## 20. 每个 PR 的完成检查

### API

- 公共类型是否最小化？
- 是否意外导出了内部实现？
- 是否重新命名了 Three.js 已有概念？
- 是否可以直接访问原生 Three.js 对象？

### 生命周期

- 谁创建？
- 谁持有？
- 谁释放？
- 何时释放？
- 失败路径是否释放？
- Abort 后晚到的结果如何处理？

### 依赖

- 依赖是否显式声明？
- 是否引入全局单例？
- 是否形成循环依赖？
- 销毁顺序是否正确？

### 测试

- 正常路径是否覆盖？
- 失败路径是否覆盖？
- 并发路径是否覆盖？
- 重复 dispose 是否覆盖？
- 是否检查泄漏？

### 性能

- 是否新增每帧全 Scene 遍历？
- 是否每帧创建临时对象？
- 是否重复调度 RAF？
- 是否在 Pointer move 中检查无关对象？

---

## 21. 最小可用版本定义

完成 M0–M5 后，可以称为“最小可用运行时”，但还不能称为完整产品。

必须具备：

- ThreeApp。
- Feature。
- Feature 依赖。
- ServiceContainer。
- 结构化清理。
- App 状态机。
- 异步回滚。
- Scheduler。
- 连续和按需渲染。
- Renderer、Scene、Camera。
- Resize 和 PixelRatio。
- 完整 dispose。

它应能可靠运行基础场景，即使还没有资产缓存和交互系统。

---

## 22. 核心稳定版完成定义

完成 M0–M12，并满足以下条件后，才发布核心稳定版：

- 架构文档中的强制契约均有实现或测试。
- Feature 依赖图无歧义。
- start/dispose 所有竞态有测试。
- AssetHandle 状态机完整。
- GLTF 共享资源所有权正确。
- 输入命中与清理规则确定。
- RenderPipeline 扩展不争夺主渲染权。
- Context lost/restored 有明确行为。
- App dispose 后无运行任务和活动资源引用。
- 浏览器矩阵通过。
- Three.js 支持范围经过验证。
- 性能和内存基准通过。
- 公共 API 已完成一次破坏性变更审查。
- 核心不依赖 Vue、React 或其他 UI 框架。

---

## 23. 最终优先级结论

最高优先级：

```text
CleanupStack
→ FeatureScope
→ ServiceContainer
→ FeatureGraph
→ ThreeApp State Machine
→ Async Rollback
```

第二优先级：

```text
Scheduler
→ RAF
→ Resize
→ Camera
→ Renderer Ownership
```

第三优先级：

```text
Asset State Machine
→ AssetHandle
→ GLTF Instances
```

最后：

```text
Input
→ RenderPipeline
→ Context Restore
→ Common Features
→ Diagnostics
```

实施过程中始终使用同一判断标准：

> 先实现决定正确性和所有权的底层契约，再实现能够被用户直接看到的功能。
