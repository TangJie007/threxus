# 核心概念

## ThreeApp

`createThreeApp(options)` 创建应用实例，负责：

- Feature 注册与拓扑安装
- Scheduler（连续 / 按需渲染）
- Renderer / Camera / Resize
- AssetManager、InputManager
- WebGL Context 状态

状态机（简版）：

```text
created → starting → running ⇄ paused → disposing → disposed
                 ↘ failed
```

## Feature

Feature 是可组合单元，不是 Three.js 子类：

```ts
import type { ThreeFeature } from '@threxus/runtime';
import { createServiceKey } from '@threxus/runtime';

const Clock = createServiceKey<{ now(): number }>('clock');

const feature: ThreeFeature = {
  name: 'clock',
  provides: [Clock],
  setup(ctx) {
    ctx.provide(Clock, { now: () => performance.now() });
    ctx.onUpdate(() => {
      // ...
    });
  },
};
```

要点：

- `provides` / `dependencies` / `optionalDependencies` 在 `start()` 前解析
- `setup` 可 async；失败会回滚已安装 Feature
- 清理走 `own` / `retain` / `addCleanup`（同一栈、LIFO）；详见 [所有权与 LIFO](./context#所有权与-lifo-清理)

## ThreeContext

`setup(ctx)` 拿到的**有作用域**上下文：场景、帧循环、服务、资产、输入与清理都通过它完成；注册项随 Feature 卸载自动释放。

| API | 用途 |
|-----|------|
| `scene` / `camera` / `renderer` / `canvas` | Three 核心对象 |
| `assets` | 加载与缓存 |
| `input` | 作用域 Pointer |
| `rendering` | Pipeline / Stage / pixelRatio |
| `provide` / `inject` | 服务 |
| `onUpdate` / `onFixedUpdate` / `invalidate` | 帧循环 |
| `own` / `retain` / `addCleanup` | 所有权（同一栈、LIFO） |
| `onContextLost` / `onContextRestored` | WebGL 恢复 |

完整说明与用法：[ThreeContext](./context) · [API 参考](/api/three-context)

## 动态 Feature

`start()` 之后可用：

```ts
await app.installFeature(myFeature);
await app.uninstallFeature('my-feature');
```

约束：

- 仅 `running` / `paused`
- 依赖的服务必须已存在
- 卸载时若仍有其它 Feature 依赖其 `provides`，会拒绝
