# createThreeApp

```ts
import { createThreeApp, type ThreeApp, type ThreeAppOptions } from '@threxus/runtime';

const app: ThreeApp = createThreeApp(options);
```

## ThreeAppOptions（常用）

| 字段 | 说明 |
|------|------|
| `canvas` | 必需 |
| `scene` / `camera` / `renderer` | 可注入外部对象并声明 ownership |
| `pixelRatio` | `number` \| `'device'` \| `{ max }` |
| `resize` | `boolean` \| ResizeOptions |
| `renderMode` | `'continuous'` \| `'on-demand'` |
| `fixedStep` / `maxDelta` | 固定步长与 delta clamp |
| `assets` | AssetManager + 默认 Loader / `gltf` 压缩选项 |
| `input` | 拾取容差、layers、pickId、节流 |
| `diagnostics` | `logger`、`lifecycleWarnings` |

## ThreeApp 方法

| 方法 | 说明 |
|------|------|
| `use(feature)` | 仅 `created` 状态注册 |
| `start()` | 安装 Feature 并启动循环 |
| `pause()` / `resume()` | 暂停 / 恢复 |
| `render()` | 手动渲染一帧 |
| `setCamera(camera, options?)` | 切换相机 |
| `installFeature` / `uninstallFeature` | 运行中动态增删 |
| `inspect()` | 运行时快照 |
| `simulateContextLost` / `simulateContextRestored` | 测试钩子 |
| `dispose()` | 完整销毁 |

## 只读属性

`state`、`graphicsState`、`canvas`、`scene`、`camera`、`renderer`、`assets`
