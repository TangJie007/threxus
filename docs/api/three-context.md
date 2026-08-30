# ThreeContext

Feature `setup(ctx)` 的运行时上下文。每个 Feature 安装时获得**独立作用域**的 `ThreeContext`：注册的回调、输入、渲染扩展与 cleanup 随该 Feature 生命周期自动管理。

使用说明与完整示例见 [指南：ThreeContext](/guide/context)。

```ts
import type { ThreeContext, ThreeFeature } from '@threxus/runtime';

const feature: ThreeFeature = {
  name: 'demo',
  setup(ctx: ThreeContext) {
    // ...
  },
};
```

## 核心对象

| 属性 | 类型 | 说明 |
|------|------|------|
| `canvas` | `HTMLCanvasElement` | App 画布 |
| `scene` | `Scene` | 共享场景（勿 dispose） |
| `camera` | `Camera` | 当前 active 相机 |
| `renderer` | `WebGLRenderer` | 共享渲染器（勿 dispose） |
| `assets` | `AssetManager` | 资产加载与缓存 |
| `input` | `ScopedInputManager` | 作用域 Pointer；Feature 结束自动解绑 |
| `rendering` | `ScopedRendering` | Pipeline / Stage / pixelRatio 等 |
| `signal` | `AbortSignal` | Feature dispose / 回滚时 abort |

```ts
ctx.scene.add(mesh);
ctx.own(mesh);

const handle = await ctx.assets.acquireTexture(url, { signal: ctx.signal });
ctx.retain(handle);
```

## 服务

| 方法 | 说明 |
|------|------|
| `provide(key, service, options?)` | 注册本 Feature 声明的服务；默认 auto dispose |
| `inject(key)` | 注入已声明依赖；缺失则抛错 |
| `injectOptional(key)` | 可选注入；无提供者时返回 `undefined` |

```ts
ctx.provide(Foo, service);                    // dispose: 'auto'（默认）
ctx.provide(Foo, service, { dispose: 'manual' });
const foo = ctx.inject(Foo);
const maybe = ctx.injectOptional(Bar);
```

`options.dispose`：

- `auto`（默认）：服务实现 `Disposable` 时，Feature 清理阶段自动 `dispose`
- `manual`：仅从容器移除，由 Feature 自行释放

## 帧循环

| 方法 | 说明 |
|------|------|
| `onUpdate(cb, options?)` | 可变步长 update |
| `onFixedUpdate(cb, options?)` | 固定步长；需配置 `fixedStep` |
| `onBeforeRender(cb, options?)` | 主渲染前 |
| `onAfterRender(cb, options?)` | 主渲染后 |
| `invalidate()` | 按需渲染模式下请求下一帧 |

均返回 `Disposable`，并自动加入当前 FeatureScope。

```ts
ctx.onUpdate(({ delta, elapsed }) => {});
ctx.onFixedUpdate(({ fixedDelta }) => {});
ctx.invalidate();
```

## 所有权与清理

三条入口最终进入**同一** Feature 清理栈，销毁时按 **LIFO**（后注册先执行）。

| 方法 | 结束时行为 | 说明 |
|------|------------|------|
| `own(object)` | `removeFromParent()` | 场景节点归属；**不**释放几何体 / 材质 |
| `retain(handle)` | `handle.dispose()` | 绑定 `AssetHandle`；减引用，归零后按策略释放资产 |
| `addCleanup(cleanup)` | 调函数或 `cleanup.dispose()` | 通用出口；返回的 `Disposable` 可提前只清这一项 |

```ts
ctx.retain(assetHandle);           // 先绑定资产
ctx.own(root);                     // 再声明场景节点
ctx.addCleanup(() => geo.dispose()); // 后注册 → dispose 时先执行
ctx.addCleanup(subscription);
```

典型销毁顺序：`addCleanup` 项 → `own`（摘树）→ `retain`（release Handle）。  
指南：[所有权与 LIFO 清理](/guide/context#所有权与-lifo-清理)。

## 输入与渲染

```ts
ctx.input.on(object, 'click', handler);

ctx.rendering.setPipeline(pipeline);
ctx.rendering.addStage(stage);
ctx.rendering.setPixelRatioOverride(1.25); // undefined 恢复默认
await ctx.rendering.withRendererState(async (renderer) => {});
```

## 事件钩子

| 方法 | 说明 |
|------|------|
| `onCameraChanged(cb)` | `setCamera` 替换 active camera |
| `onContextLost(cb)` | WebGL context 丢失 |
| `onContextRestored(cb)` | WebGL context 恢复；可 async，按 Feature 安装序执行 |

```ts
ctx.onCameraChanged(({ previous, current }) => {});
ctx.onContextLost(() => {});
ctx.onContextRestored(async () => {});
```

## ThreeFeature 形状

```ts
import type {
  ServiceDefinition,
  ServiceKey,
} from '@threxus/runtime';

interface ThreeFeature {
  name: string;
  provides?: Array<ServiceKey | ServiceDefinition>;
  dependencies?: ServiceKey[];
  optionalDependencies?: ServiceKey[];
  setup?(ctx: ThreeContext): void | Promise<void>;
}
```

契约要点：

- `defineService` 返回值放入 `provides` 后，Runtime 会自动执行 handler 并注册服务
- 直接放入 `provides` 的 `ServiceKey` 必须在 `setup` 内手动 `provide`
- `inject` / `injectOptional` 只能访问 `dependencies` + `optionalDependencies` + `provides`
- `setup` 可为 async；应用 `ctx.signal` 协作取消
