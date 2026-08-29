# Threxus

面向功能和生命周期的 Three.js 轻量运行时。

Threxus 保留 Three.js 原生对象模型，集中管理 Feature 依赖、服务、异步初始化和结构化销毁。

完整设计见 [THREEJS-ENCAPSULATION-DESIGN.md](./THREEJS-ENCAPSULATION-DESIGN.md)，实施顺序见 [THREEJS-IMPLEMENTATION-ROADMAP.md](./THREEJS-IMPLEMENTATION-ROADMAP.md)。

## 项目结构

```text
packages/
  runtime/    @threxus/runtime —— App / Feature / Service / Lifecycle
examples/
  vue3/       M0–M3 生命周期与失败回滚演示
  test/       独立 Three.js 实验项目
```

## 当前实现范围

当前完成 M0–M3：

- `Disposable` 与 `CleanupStack`
- 强类型 `ServiceKey`
- Feature 服务依赖图和稳定拓扑排序
- FeatureScope、AbortSignal 和反向清理
- ThreeApp 启动、失败回滚和幂等销毁

```ts
import {
  createServiceKey,
  createThreeApp,
  type ThreeFeature,
} from '@threxus/runtime';

const Clock = createServiceKey<{ now(): number }>('clock');

const provider: ThreeFeature = {
  name: 'clock-provider',
  provides: [Clock],
  setup(context) {
    context.provide(Clock, { now: () => Date.now() });
    context.addCleanup(() => {
      // 释放当前 Feature 拥有的资源
    });
  },
};

const app = createThreeApp({ canvas });
app.use(provider);

await app.start();
await app.dispose();
```

Renderer、Camera、Scheduler 和真实 3D 渲染属于后续 M4–M5，因此 Vue3 当前展示生命周期状态而不是 3D 画面。

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
