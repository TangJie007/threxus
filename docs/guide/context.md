# ThreeContext

`ThreeContext`（常写作 `ctx` / `context`）是 Feature `setup` 拿到的**有作用域运行时入口**：场景对象、帧循环、服务、资产、输入、渲染扩展与清理都通过它完成。

每个 Feature 在安装时会拿到**自己的** context——`input` / `rendering` / 回调 / cleanup 都绑定到该 Feature 的生命周期，卸载时自动解绑与释放。

## 它解决什么

直接操作全局 `scene` / `renderer` 时，异步加载失败、动态卸载 Feature、WebGL Context 丢失很容易漏清资源。`ThreeContext` 把这些操作收束到 Feature 作用域：

| 能力 | 作用 |
|------|------|
| 作用域注册 | `onUpdate`、`input.on`、`rendering.addStage` 随 Feature 自动解绑 |
| 所有权 | `own` / `retain` / `addCleanup`（同一清理栈，[LIFO](#所有权与-lifo-清理)） |
| 服务契约 | `provide` / `inject` 与 `provides` / `dependencies` 声明一致 |
| 取消 | `signal` 在 dispose / 失败回滚时 abort，可传给 `assets.acquire*` |

## 最小用法

```ts
import type { ThreeFeature } from '@threxus/runtime';
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';

const feature: ThreeFeature = {
  name: 'spinning-box',
  setup(ctx) {
    const mesh = new Mesh(
      new BoxGeometry(),
      new MeshStandardMaterial({ color: 0x409eff }),
    );
    ctx.scene.add(mesh);
    ctx.own(mesh); // Feature 结束时从父节点移除

    ctx.addCleanup(() => {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    });

    ctx.onUpdate(({ delta }) => {
      mesh.rotation.y += delta;
    });
  },
};
```

## 核心对象

```ts
setup(ctx) {
  ctx.canvas;   // HTMLCanvasElement
  ctx.scene;    // 共享 Scene
  ctx.camera;   // 当前 active Camera（可被 setCamera 替换）
  ctx.renderer; // WebGLRenderer
  ctx.signal;   // Feature 级 AbortSignal
}
```

`scene` / `camera` / `renderer` 是 App 级共享对象；不要在 Feature 里 `dispose` 它们。自己创建的几何体、材质、贴图、临时 Object3D 才需要 `own` / `addCleanup` / `retain`。

## 帧循环

```ts
ctx.onUpdate(({ delta, elapsed }) => {
  // 可变步长，每帧一次
});

ctx.onFixedUpdate(({ fixedDelta }) => {
  // 需 createThreeApp({ fixedStep: 1 / 60 })
});

ctx.onBeforeRender(() => {});
ctx.onAfterRender(() => {});

ctx.invalidate(); // renderMode: 'on-demand' 时请求下一帧
```

返回值均为 `Disposable`；也可不保存——Feature dispose 时会统一清理。

## 服务：provide / inject

推荐使用 `defineService`。Service handler 的返回值会由 Runtime 自动
注册，不需要在 Feature 中重复调用 `ctx.provide`：

```ts
import { defineService, type ThreeFeature } from '@threxus/runtime';

const Counter = defineService(
  'counter',
  () => ({
    tick() {
      // ...
    },
  }),
);

const provider: ThreeFeature = {
  name: 'counter-provider',
  provides: [Counter],
};
```

只有需要完全控制注册过程时，才使用下面的底层写法：

```ts
import { createServiceKey, type ThreeFeature } from '@threxus/runtime';

const Counter = createServiceKey<{ tick(): void }>('counter');

const provider: ThreeFeature = {
  name: 'counter-provider',
  provides: [Counter],
  setup(ctx) {
    let n = 0;
    ctx.provide(Counter, {
      tick: () => {
        n += 1;
      },
    });
  },
};

const consumer: ThreeFeature = {
  name: 'counter-consumer',
  dependencies: [Counter],
  setup(ctx) {
    const counter = ctx.inject(Counter);
    ctx.onUpdate(() => counter.tick());
  },
};
```

规则摘要：

- `defineService` 返回值放入 `provides` 后会自动创建并注册服务
- 直接放入 `provides` 的 `ServiceKey` 必须在 `setup` 里手动 `provide`
- `inject` / `injectOptional` 只能访问已声明的 `dependencies` / `optionalDependencies` / `provides`
- `provide` 默认在 Feature 清理时移除服务；若服务实现了 `dispose`，会自动调用（可用 `{ dispose: 'manual' }` 关闭）

更多见 [Feature 与服务](./features)。

## 资产与取消

```ts
setup(async (ctx) => {
  const handle = await ctx.assets.acquireGLTF('/model.glb', {
    signal: ctx.signal, // dispose / 回滚时取消加载
  });
  ctx.retain(handle); // Feature 结束时 release

  const instance = handle.value.instantiate({
    mode: 'clone',
    materials: 'shared',
  });
  ctx.scene.add(instance.root);
  ctx.addCleanup(instance); // 实例与资产分开管
});
```

异步 `setup` 中应优先把 `ctx.signal` 传给加载 API，避免卸载后仍继续写场景。

## 输入与渲染扩展

```ts
ctx.input.on(mesh, 'click', (event) => {
  console.log(event.object);
});

ctx.rendering.addStage({
  name: 'overlay-debug',
  stage: 'overlay',
  priority: 0,
  render() {},
});

ctx.rendering.setPixelRatioOverride(1.25);
```

二者都是**作用域 API**：当前 Feature 卸载时注册自动撤销。详见 [输入与拾取](./input)、[渲染与后处理](./rendering)。

## 所有权与 LIFO 清理

Feature 持有的资源要在卸载（或 `setup` 失败回滚）时释放。`ThreeContext` 提供三条入口，**最终都进入同一个 CleanupStack**，按 **LIFO（后注册 → 先执行）** 跑完。

### 三者分别管什么

| API | 管什么 | Feature 结束时做什么 | 不管什么 |
|-----|--------|----------------------|----------|
| `own(object3D)` | 场景图节点归属 | `object.removeFromParent()` | **不** `dispose` 几何体 / 材质 / 贴图 |
| `retain(handle)` | 资产 `AssetHandle` 引用 | `handle.dispose()`（减引用；归零后按策略延迟释放 GPU） | 场景实例、材质副本 |
| `addCleanup(fn \| disposable)` | 其余一切 | 调函数，或调 `disposable.dispose()` | — |

记忆方式：

- **场景里挂了节点** → `own`（只负责「从树上摘掉」）
- **`acquire*` 拿到的 Handle** → `retain`（只负责「放掉引用」）
- **GPU 资源、订阅、自定义对象** → `addCleanup`（几何体 / 材质 / `instantiate` 实例 / 事件监听等）

`own` ≠ 完整销毁：Three.js 里从父节点移除不会释放 BufferGeometry / Material；这些必须另写 `addCleanup`。

### LIFO 是什么意思

同一 Feature 内，清理项压进栈；销毁时从**栈顶**往下执行：

```text
setup 注册顺序（时间早 → 晚）
  1. retain(gltfHandle)
  2. own(root)
  3. addCleanup(instance)      // instantiate 的场景实例
  4. addCleanup(() => geo.dispose())

dispose 执行顺序（后注册先跑）
  4 → 3 → 2 → 1
  先 dispose 几何体 / 实例
  再 removeFromParent
  最后 release 资产 Handle
```

这样用资产的一侧会先停掉，再减引用，避免「Handle 已 release、场景还在读 `handle.value`」。

`onUpdate` / `input.on` / `provide` / `rendering.addStage` 等也会往**同一栈**里塞 cleanup，同样遵守 LIFO。不必手写解绑，但要意识到：**你手写的 `addCleanup` 与这些隐式项排在同一条时间线上**。

### 推荐写法

```ts
setup(async (ctx) => {
  // 1) 资产：acquire → retain
  const handle = await ctx.assets.acquireGLTF('/model.glb', {
    signal: ctx.signal,
  });
  ctx.retain(handle);

  // 2) 场景节点：add → own（只摘树，不 dispose GPU）
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  root.add(mesh);
  ctx.scene.add(root);
  ctx.own(root);

  // 3) GPU / 实例 / 订阅：addCleanup（写在 own 之后 → 会先于 own 执行）
  ctx.addCleanup(() => {
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  const instance = handle.value.instantiate({ mode: 'clone', materials: 'shared' });
  root.add(instance.root);
  ctx.addCleanup(instance); // 实现了 dispose() 即可直接传入

  const onResize = () => ctx.invalidate();
  window.addEventListener('resize', onResize);
  ctx.addCleanup(() => window.removeEventListener('resize', onResize));
});
```

对应销毁顺序（节选）：`removeEventListener` → `instance.dispose()` → `geometry/material.dispose()` → `root.removeFromParent()` → `handle.dispose()`。

### 注意点

- **先用后放**：先 `retain` / `own`，再注册依赖它们的 `addCleanup`，让依赖方在 LIFO 下先清理。
- **提前释放**：`addCleanup` 返回的 `Disposable` 可单独 `dispose()`，只跑这一项并从栈中摘掉；Feature 总 dispose 时不会再跑第二次。
- **失败回滚**：`setup` 中途抛错时，**已经注册**的 cleanup 仍会 LIFO 执行；尚未执行到的 `own`/`retain` 不会入栈。
- **不要**对共享的 `scene` / `camera` / `renderer` 做 `own` 或在 cleanup 里 `dispose`。
- **不要**以为 `own(mesh)` 会释放 `mesh.geometry`；漏写 `addCleanup` 就会泄漏 GPU 内存。

## WebGL Context 丢失 / 恢复

```ts
ctx.onContextLost(() => {
  // 暂停依赖 GPU 资源的逻辑
});

ctx.onContextRestored(async () => {
  // 重建 RenderTarget / Composer 等；可 async
});
```

测试可用 `app.simulateContextLost()` / `app.simulateContextRestored()`。自定义 Pipeline / Pass 应实现 `restore()`。

## 完整组合示例

```ts
import {
  createServiceKey,
  type ThreeFeature,
} from '@threxus/runtime';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';

const BoxApi = createServiceKey<{ mesh: Mesh }>('box-api');

export function createBoxFeature(): ThreeFeature {
  return {
    name: 'box',
    provides: [BoxApi],
    async setup(ctx) {
      const tex = await ctx.assets.acquireTexture('/albedo.png', {
        signal: ctx.signal,
      });
      ctx.retain(tex);

      const root = new Group();
      const mesh = new Mesh(
        new BoxGeometry(),
        new MeshStandardMaterial({ map: tex.value }),
      );
      root.add(mesh);
      ctx.scene.add(root);
      ctx.own(root);
      ctx.addCleanup(() => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });

      ctx.input.on(mesh, 'click', () => ctx.invalidate());
      ctx.onUpdate(({ delta }) => {
        mesh.rotation.y += delta;
      });

      ctx.provide(BoxApi, { mesh });
    },
  };
}
```

## 相关文档

- API 速查：[ThreeContext](/api/three-context)
- [Feature 与服务](./features)
- [资产系统](./assets)
- [核心概念](./concepts)
