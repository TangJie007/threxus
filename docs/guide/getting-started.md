# 快速开始

## 环境

- Node.js `>= 22.12`
- `three` peer：`>=0.180.0 <1`

## 安装

```bash
pnpm add @threxus/runtime three
```

## 最小示例

```ts
import { createThreeApp, environmentFeature } from '@threxus/runtime';

const canvas = document.querySelector('canvas')!;

const app = createThreeApp({
  canvas,
  camera: {
    type: 'perspective',
    position: [3, 2, 5],
    target: [0, 0, 0],
  },
});

app.use(
  environmentFeature({
    background: '#0b1220',
    ground: { size: 20 },
  }),
);

app.use({
  name: 'hello-box',
  async setup(ctx) {
    const { Mesh, BoxGeometry, MeshStandardMaterial } = await import('three');
    const mesh = new Mesh(
      new BoxGeometry(),
      new MeshStandardMaterial({ color: 0x409eff }),
    );
    ctx.scene.add(mesh);
    ctx.own(mesh);
    ctx.onUpdate(({ delta }) => {
      mesh.rotation.y += delta;
    });
  },
});

await app.start();

// 页面卸载
window.addEventListener('beforeunload', () => {
  void app.dispose();
});
```

`setup(ctx)` 里的 `ctx` 是 [ThreeContext](./context)：用它访问 `scene`、注册 `onUpdate`、管理 `own` / `addCleanup` 等。

## Vue 中使用

在组件里创建 App，卸载时 `dispose`：

```ts
import { createThreeApp } from '@threxus/runtime';
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const app = shallowRef<ReturnType<typeof createThreeApp> | null>(null);

onMounted(async () => {
  const runtime = createThreeApp({ canvas: canvasRef.value! });
  // runtime.use(...)
  app.value = runtime;
  await runtime.start();
});

onBeforeUnmount(() => {
  void app.value?.dispose();
});
```

仓库内完整演示：`examples/vue3`，开发：

```bash
pnpm --dir examples/vue3 dev
```

打开 `/cube` 可看到资产、拾取、后处理、Context 模拟与诊断面板。
