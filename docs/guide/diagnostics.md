# 诊断与质量

## Logger

```ts
import { createLogger, createThreeApp } from '@threxus/runtime';

const logger = createLogger({
  level: 'info',
  scope: 'app',
  sink: (level, message, args) => {
    console[level === 'debug' ? 'debug' : level](message, ...args);
  },
});

createThreeApp({
  canvas,
  diagnostics: {
    logger,
    lifecycleWarnings: true, // 默认非 production 开启
  },
});
```

## inspectRuntime

```ts
import { inspectRuntime } from '@threxus/runtime';

const snap = inspectRuntime(app);
console.log(snap.summary.healthy, snap.summary.issues);
console.log(snap.renderer?.drawCalls, snap.app.assets.totalRefs);
```

也可用 `app.inspect()` 获取运行时快照（状态、Feature、scheduler、input、rendering）。

## 质量档

```ts
import { qualityFeature, QualityService } from '@threxus/runtime';

app.use(
  qualityFeature({
    tiers: [
      { id: 'high', pixelRatio: 2, passes: { gtao: true, bloom: true } },
      { id: 'medium', pixelRatio: 1.25, passes: { gtao: false, bloom: true } },
      { id: 'low', pixelRatio: 1, passes: { gtao: false, bloom: false } },
    ],
    initialTierId: 'medium',
    auto: { enabled: true, targetFps: 45, sampleSeconds: 1.5 },
  }),
);

// 运行时
ctx.inject(QualityService).setTier('low');
```

依赖 `effectComposerFeature` 时，Pass 开关通过 `EffectComposerService.setPassEnabled` 生效；`gtao` 需在 Composer 创建时显式启用（`gtao: true`）以便存在可切换的 Pass。

## 浏览器矩阵

见 [浏览器矩阵](/reference/browser-matrix)。
