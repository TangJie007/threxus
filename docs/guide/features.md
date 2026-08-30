# Feature 与服务

## 注册顺序

```ts
app.use(featureA);
app.use(featureB);
await app.start(); // 按依赖拓扑安装，不是 use 的书写顺序单独决定一切
```

同层无依赖边时，按注册顺序稳定排序。

## 服务契约

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
- `provides` 声明了就必须在 `setup` 里 `provide`
- 不允许把同一 Key 同时放进 `dependencies` 与 `optionalDependencies`

## 清理

```ts
setup(ctx) {
  const light = new DirectionalLight();
  ctx.scene.add(light);
  ctx.own(light); // Feature dispose 时从场景移除（按所有权策略）

  const sub = selection.onChange(() => {});
  ctx.addCleanup(sub); // 或 () => sub.dispose()

  const handle = await ctx.assets.acquireTexture(url);
  ctx.retain(handle); // Feature 结束时 release
}
```

## 失败回滚

`start()` 中任一 Feature `setup` 抛错：

1. 已激活 Feature 逆序 dispose
2. 渲染 / 输入子系统释放
3. App 进入 `failed`（除非同时在 dispose）
