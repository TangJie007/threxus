# 渲染与后处理

## 渲染模式

```ts
createThreeApp({
  canvas,
  renderMode: 'on-demand', // 或 continuous（默认）
});

// Feature 内
ctx.invalidate(); // 按需模式下请求一帧
```

## RenderStage

```ts
ctx.rendering.addStage({
  name: 'overlay-debug',
  stage: 'overlay', // before-main-render | after-main-render | overlay
  priority: 0,
  render({ renderer, scene, camera }) {
    // 绘制调试线、CSS2D 等
  },
});
```

## 轻量 Postprocessing

```ts
import { postprocessingFeature, PostprocessingService } from '@threxus/runtime';

app.use(postprocessingFeature({ pipelineName: 'fx' }));

app.use({
  name: 'my-pass',
  dependencies: [PostprocessingService],
  setup(ctx) {
    ctx.inject(PostprocessingService).addPass({
      id: 'tint',
      priority: 0,
      render() {},
      restore() {},
    });
  },
});
```

## EffectComposer

工业向完整管线（Render → 可选 GTAO → Bloom → Outline → FXAA → Output）：

```ts
import {
  effectComposerFeature,
  selectionFeature,
  selectionOutlineFeature,
} from '@threxus/runtime';

app.use(
  effectComposerFeature({
    gtao: true,
    bloom: { strength: 0.3 },
    outline: true,
    fxaa: true,
  }),
);
app.use(selectionFeature());
app.use(selectionOutlineFeature()); // 选中自动写入 OutlinePass
```

Pass 开关：

```ts
const composer = ctx.inject(EffectComposerService);
composer.setPassEnabled('bloom', false);
composer.setPassEnabled('gtao', true);
```

## Context 丢失 / 恢复

```ts
ctx.onContextLost(() => {});
ctx.onContextRestored(async () => {});

// 测试钩子
app.simulateContextLost();
await app.simulateContextRestored();
```

自定义 Pipeline / Pass 应实现 `restore()`，在 restore 时重建 RenderTarget。
