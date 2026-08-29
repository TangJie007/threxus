# Threxus

面向功能和生命周期的 Three.js 轻量运行时。

Threxus 保留 Three.js 原生对象模型，集中管理 Feature 依赖、服务、异步初始化和结构化销毁。

完整设计见 [THREEJS-ENCAPSULATION-DESIGN.md](./THREEJS-ENCAPSULATION-DESIGN.md)，实施顺序见 [THREEJS-IMPLEMENTATION-ROADMAP.md](./THREEJS-IMPLEMENTATION-ROADMAP.md)。

## 项目结构

```text
packages/
  runtime/    @threxus/runtime —— App / Feature / Service / Lifecycle / Assets / Input / Rendering / Features
examples/
  vue3/       M0–M11 演示
  test/       独立 Three.js 实验项目
```

## 当前实现范围

当前完成 M0–M11：

- 微内核：Disposable、ServiceKey、FeatureGraph、ThreeApp、Scheduler、WebGL、Assets、GLTF、Input、RenderPipeline、Context restore
- **内置 Feature（M11）**：
  - `environmentFeature` — 背景 / 灯光 / 地面
  - `orbitControlsFeature` — OrbitControls + `CameraControlService`
  - `selectionFeature` — 点选 + `SelectionService`
  - `highlightFeature` — 依赖 Selection 的 emissive 高亮
  - `statsFeature` — FPS / Renderer info / 资产统计
  - `postprocessingFeature` — 唯一 Composer Pipeline + `PostprocessingService.addPass`

```ts
app
  .use(environmentFeature({ background: 0x101820 }))
  .use(orbitControlsFeature({ damping: true }))
  .use(selectionFeature())
  .use(highlightFeature())
  .use(statsFeature())
  .use(postprocessingFeature());
```

诊断、性能基准与稳定发布属于 **M12**。

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
