# Threxus

面向功能和生命周期的 Three.js 轻量运行时。

Threxus 保留 Three.js 原生对象模型，集中管理 Feature 依赖、服务、异步初始化和结构化销毁。

完整设计见 [THREEJS-ENCAPSULATION-DESIGN.md](./THREEJS-ENCAPSULATION-DESIGN.md)，实施顺序见 [THREEJS-IMPLEMENTATION-ROADMAP.md](./THREEJS-IMPLEMENTATION-ROADMAP.md)。

## 项目结构

```text
packages/
  runtime/    @threxus/runtime —— App / Feature / Service / Lifecycle / Assets
examples/
  vue3/       M0–M7 演示
  test/       独立 Three.js 实验项目
```

## 当前实现范围

当前完成 M0–M7：

- `Disposable` 与 `CleanupStack`
- 强类型 `ServiceKey`
- Feature 服务依赖图和稳定拓扑排序
- FeatureScope、AbortSignal 和反向清理
- ThreeApp 启动、失败回滚和幂等销毁
- Scheduler：RAF 循环、`onUpdate` / `onFixedUpdate` / 渲染阶段钩子
- **WebGL**：Scene / Camera / Renderer、ResizeObserver、DirectRenderPipeline、`ctx.own()`
- **AssetManager**：Key 规范化、并发合并、Handle 引用计数、延迟释放、`ctx.retain()`、Texture / CubeTexture / File Loader
- **GLTF**：`acquireGLTF`、`instantiate`（clone / skeleton-clone / shared）、共享 GPU 与实例私有 Material 所有权

```ts
const handle = await ctx.assets.acquireGLTF('/models/machine.glb');
ctx.retain(handle);

const instance = handle.value.instantiate({
  mode: 'auto',
  materials: 'shared',
});
ctx.scene.add(instance.root);
ctx.own(instance.root);
ctx.addCleanup(instance);
```

输入与射线交互属于 **M8**。

## 开始使用

需要 Node.js `>=22.12.0` 与 pnpm `11.24.0`。

```bash
pnpm install
pnpm dev
```

正式构建：

```bash
pnpm build
```

## 常用命令

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm --dir packages/runtime test:types
pnpm --dir packages/runtime test:browser
pnpm --dir examples/vue3 test:e2e
```
