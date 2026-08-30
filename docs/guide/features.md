# Feature 与服务

`setup(ctx)` 中的 `ctx` 即 [ThreeContext](./context)：场景操作、帧循环、服务与清理都经它完成。

## 注册顺序

```ts
app.use(featureA);
app.use(featureB);
await app.start(); // 按依赖拓扑安装，不是 use 的书写顺序单独决定一切
```

同层无依赖边时，按注册顺序稳定排序。

## 服务契约

最常用的方式是使用 `defineService` 定义服务，再由 Feature 声明提供它：

```ts
import { defineFeature, defineService } from '@threxus/runtime';

const Foo = defineService<FooService>(
  'foo',
  async (ctx) => {
    return createFooService(ctx);
  },
);

const fooFeature: ThreeFeature = {
  name: 'foo',
  provides: [Foo],
};
```

Runtime 会在 Feature 的 `setup` 阶段自动执行 Service handler，并将返回值注册到当前服务容器。其它 Feature 只需要声明依赖并注入：

```ts
const consumer: ThreeFeature = {
  name: 'foo-consumer',
  dependencies: [Foo],
  setup(ctx) {
    const foo = ctx.inject(Foo);
  },
};
```

底层场景仍可使用 `createServiceKey` 和手动 `ctx.provide`，适合需要完全自定义注册过程的高级用法：

```ts
const Foo = createServiceKey<FooService>('foo');

const provider: ThreeFeature = {
  name: 'foo-provider',
  provides: [Foo],
  setup(ctx) {
    ctx.provide(Foo, { /* ... */ });
  },
};

const consumer: ThreeFeature = {
  name: 'foo-consumer',
  dependencies: [Foo],
  setup(ctx) {
    const foo = ctx.inject(Foo);
    const maybe = ctx.injectOptional(Foo); // 仅 optionalDependencies / provides
  },
};
```

规则：

- 同一 `ServiceKey` 只能有一个提供者
- `defineService` 返回值放入 `provides` 后会自动创建并提供服务
- 直接放入 `provides` 的 `ServiceKey` 仍必须在 `setup` 里手动 `provide`
- 不允许把同一 Key 同时放进 `dependencies` 与 `optionalDependencies`

## 清理与所有权

三条 API 进**同一** Feature 清理栈，销毁时 **LIFO**（后注册先执行）。分工：

| API | 结束时 | 注意 |
|-----|--------|------|
| `own(object)` | `removeFromParent()` | **不** dispose 几何体 / 材质 |
| `retain(handle)` | `handle.dispose()` 减引用 | 只用于 `assets.acquire*` 的 Handle |
| `addCleanup(x)` | 调函数或 `x.dispose()` | 几何体、材质、实例、订阅等 |

```ts
setup(async (ctx) => {
  const handle = await ctx.assets.acquireTexture(url, { signal: ctx.signal });
  ctx.retain(handle); // 后于依赖方清理时再 release

  const light = new DirectionalLight();
  ctx.scene.add(light);
  ctx.own(light); // 只从场景树移除

  ctx.addCleanup(() => {
    /* 材质 / 几何体 / 自定义资源 */
  });
});
```

完整说明（含 LIFO 顺序示例）：[所有权与 LIFO 清理](./context#所有权与-lifo-清理)。

## 失败回滚

`start()` 中任一 Feature `setup` 抛错：

1. 已激活 Feature 逆序 dispose
2. 渲染 / 输入子系统释放
3. App 进入 `failed`（除非同时在 dispose）
