# 资产系统

## 默认 Loader

创建 App 时默认注册：

- `texture`
- `cube-texture`
- `file`
- `gltf`（DRACO / Meshopt；KTX2 在 renderer 绑定后 detectSupport）
- `environment-map`（HDR → PMREM）

```ts
const app = createThreeApp({
  canvas,
  assets: {
    releaseDelayMs: 30_000,
    gltf: {
      // dracoPath / ktx2Path 可选；默认走 three 内置路径
      meshopt: true,
    },
  },
});
```

## 常用 API

```ts
setup(async (ctx) => {
  const tex = await ctx.assets.acquireTexture('/tex.png', {
    signal: ctx.signal,
    loaderOptions: { colorSpace: 'srgb' },
  });
  ctx.retain(tex);

  const gltf = await ctx.assets.acquireGLTF('/model.glb', {
    signal: ctx.signal,
  });
  ctx.retain(gltf);

  const instance = gltf.value.instantiate({
    mode: 'clone',
    materials: 'shared',
  });
  ctx.scene.add(instance.root);
  ctx.addCleanup(instance);

  const env = await ctx.assets.acquireEnvironmentMap('/env.hdr', {
    signal: ctx.signal,
  });
  ctx.retain(env);
  ctx.scene.environment = env.value;
});
```

## 引用与释放

- 同一 URL 并发 `acquire` 会合并加载
- `handle.dispose()` / Feature `retain` 结束时减少引用
- 引用归零后延迟释放（`releaseDelayMs`，演示可设 `0`）

## 自定义 Loader

```ts
createThreeApp({
  canvas,
  assets: {
    loaders: [myLoader],
  },
});
```
