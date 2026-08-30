# ThreeContext

Feature `setup(ctx)` 的上下文类型：`ThreeContext`。

## 场景与循环

```ts
ctx.scene
ctx.camera
ctx.renderer
ctx.canvas
ctx.signal // AbortSignal，dispose / 失败时 abort

ctx.onUpdate((info) => {})
ctx.onFixedUpdate((info) => {}) // 需配置 fixedStep
ctx.invalidate()
```

## 服务

```ts
ctx.provide(Key, service, { dispose?: 'auto' | 'manual' })
ctx.inject(Key)
ctx.injectOptional(Key)
```

## 输入与渲染

```ts
ctx.input.on(object, type, handler)

ctx.rendering.setPipeline(pipeline)
ctx.rendering.addStage(stage)
ctx.rendering.setPixelRatioOverride(1.25) // undefined 恢复默认
ctx.rendering.withRendererState(async (renderer) => {})
```

## 生命周期

```ts
ctx.own(object3D)
ctx.retain(assetHandle)
ctx.addCleanup(disposableOrFn)

ctx.onCameraChanged(({ previous, current }) => {})
ctx.onContextLost(() => {})
ctx.onContextRestored(async () => {})
```

## ThreeFeature 形状

```ts
interface ThreeFeature {
  name: string;
  provides?: ServiceKey[];
  dependencies?: ServiceKey[];
  optionalDependencies?: ServiceKey[];
  setup(ctx: ThreeContext): void | Promise<void>;
}
```
