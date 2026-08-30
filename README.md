# Threxus

面向功能和生命周期的 Three.js 轻量运行时。

Threxus 保留 Three.js 原生对象模型，集中管理 Feature 依赖、服务、异步初始化和结构化销毁。

完整设计见 [THREEJS-ENCAPSULATION-DESIGN.md](./THREEJS-ENCAPSULATION-DESIGN.md)，实施顺序见 [THREEJS-IMPLEMENTATION-ROADMAP.md](./THREEJS-IMPLEMENTATION-ROADMAP.md)。

## 使用文档（VitePress）

```bash
pnpm docs:dev      # http://localhost:5175
pnpm docs:build
pnpm docs:preview
```

源码在 `docs/`：指南、API、示例说明。

## 项目结构

```text
packages/
  runtime/    @threxus/runtime —— App / Feature / Assets / Input / Rendering / Features / Diagnostics
docs/
  .vitepress/   VitePress 配置与主题
  guide/        使用指南
  api/          API 摘要
  examples/     示例说明
  reference/    浏览器矩阵等
examples/
  vue3/         M0–M12 演示
  test/         独立 Three.js 实验项目
```

## 当前实现范围

**M0–M12 已完成（核心稳定版范围）**：

- 微内核：Disposable、ServiceKey、FeatureGraph、ThreeApp、Scheduler、WebGL、Assets、GLTF、Input、RenderPipeline、Context restore
- 内置 Feature：Environment / OrbitControls / Selection / Highlight / Stats / Postprocessing
- **诊断（M12）**：`createLogger`、`inspectRuntime`、生命周期警告、性能/内存基线测试、浏览器矩阵文档

```ts
import { createLogger, createThreeApp, inspectRuntime } from '@threxus/runtime';

const app = createThreeApp({
  canvas,
  diagnostics: {
    logger: createLogger({ level: 'warn' }),
    lifecycleWarnings: true,
  },
});

await app.start();
console.log(inspectRuntime(app).summary);
```

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
