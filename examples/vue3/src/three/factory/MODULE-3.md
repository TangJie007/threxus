# 模块 3 · 材质、光照与环境反射

> 对应 test 训练模块 3，已迁入 FactoryTwin 路由（`/factory-twin`）。
> 目标：在 **不依赖外部 HDRI / 贴图包** 的前提下，让地坪、钢材、机柜、状态灯看起来「像厂房」。

## 1. 你现在能看到什么

打开 Vue3 示例 → **FactoryTwin 重构**（`/factory-twin`）：

| 物体 | 材质 key | 要点 |
|---|---|---|
| 大地面 | `floor` | 程序化水泥 + 法线 + 粗糙度 |
| 立柱方块 | `steel` | `metalness = 1`，吃环境反射 |
| 机柜 | `machine` | 涂装钣金，`metalness = 0.25` |
| 深色箱 + 玻璃片 | `plastic` / `glass` | 非金属 vs 假透明 |
| 黄黑条 | `hazard` | Canvas 警示条纹 |
| 三颗球 | `emissive*` | `toneMapped: false` 的自发光 |

相机默认俯瞰约 `(28, 22, 32)`，与 test 起点对齐。

## 2. 文件对照（test → vue3）

| 学什么 | test 原路径 | 本仓库迁入位置 |
|---|---|---|
| 程序化贴图 / Sobel 法线 | `examples/test/src/materials/ProceduralTextures.ts` | `materials/ProceduralTextures.ts` |
| PBR 预设库 | `examples/test/src/materials/Presets.ts` | `materials/Presets.ts` |
| 环境贴图 + 灯光 + 阴影 | `examples/test/src/scene/Environment.ts` | `environment/Environment.ts` |
| 接到场景 | `main.ts` 里 `buildMaterials()` + `new Environment(...)` | `factory-scene.feature.ts` |

Threxus 差异（重要）：

- **不自己 new Viewer**：`WebGLRenderer` / `Scene` 由 `ThreeCoreModule` 注入。
- Environment 直接吃 `@Inject(WebGLRenderer)` 与 `this.scenes.active`。
- 卸载走 Feature 的 `onDispose()`：环境光、材质、程序化贴图一起释放（HMR 安全）。

## 3. 三条铁律（背下来）

### ① 金属发黑 = 没有环境贴图

PBR 金属几乎不靠漫反射，靠 `scene.environment` 里的反射。

本模块用 **临时房间场景 + `PMREMGenerator.fromScene`** 烘一张 envMap，烘完扔掉房间，只留贴图。

动手：在 `Environment` 构造里注释掉这两行，刷新：

```ts
scene.environment = this.envMap;
scene.environmentIntensity = 0.85;
```

钢材会立刻变黑。再把 `environmentIntensity` 调到 `2.0`，体会「整体高级感旋钮」。

### ② metalness 纪律

| 表面 | metalness | 原因 |
|---|---|---|
| 裸钢 / 铝型材 | `1.0` | 导体 |
| 喷涂钣金（机柜） | `~0.25` | 涂层是电介质 |
| 塑料 / 橡胶 / 地坪 | `0` | 非金属 |

中间值滥用 → 画面发灰。对照场景里的 `steel` 与 `machine`。

### ③ 自发光要冲破 tone mapping

ACES 会把亮度压回可显示范围。状态灯若保持默认 `toneMapped: true`，强度再高也进不了后续 Bloom 阈值。

本模块已设 `toneMapped: false`。Bloom 要等模块 4（Composer）；现在先记住：**发光材质先把能量留住**。

## 4. 代码阅读顺序（建议 40 分钟）

1. **`ProceduralTextures.heightToNormal`**  
   Sobel 从高度图求导 → 切线空间法线。没有它，地坪再打光也是平板。
2. **`Presets.buildMaterials`**  
   看每种材质的 `roughness` / `metalness` / `envMapIntensity` 组合。
3. **`Environment` 构造函数**  
   色彩管理三件套 → PMREM → 半球光 + 单盏投影主光 + 补光。  
   阴影只留一盏 DirectionalLight：贵，所以要克制。
4. **`FactorySceneFeature.onModuleInit`**  
   装配顺序：`buildMaterials` → `Environment` → 用 `mat()` 挂 Mesh → `spawn`。

## 5. 动手任务

按顺序做，每做完一项在画面上确认：

1. **关掉环境贴图**（见 §3①），截一张钢材对比图。
2. 把 `machine` 的 `metalness` 改成 `1.0`，看涂装件是否「假金属」。
3. 把地坪 `normalScale` 从 `(0.55, 0.55)` 改成 `(2, 2)`，观察颗粒被夸大。
4. 临时去掉 `renderer.toneMapping = ACESFilmicToneMapping`，看整体是否发灰/过曝。
5. （可选）把 `sun.shadow.mapSize` 改成 `512`，观察阴影锯齿。

改完记得还原，或靠 Vite HMR / 刷新验证 `onDispose` 没有把环境光叠多层（多刷几次不应越来越亮）。

## 6. 和 test 的差异清单

| 点 | test | 本重构页 |
|---|---|---|
| 资源中心 | `Resources.environmentFromScene` | Feature 内自建 `PMREMGenerator` |
| HDRI 切换 | `useHDRI` | 未迁（需要时再加） |
| 场景内容 | 完整工厂 | 材质展台样件 |
| 渲染器配置 | `Viewer` 内集中设置 | `Environment` 内补齐色彩管理与阴影 |

## 7. 下一步

模块 3 过关标准：**钢材有高光条、地坪有起伏、机柜不是塑料感、三盏状态灯颜色分明**。

然后进入模块 2 简化版：把 `Factory.ts` 的厂房结构迁进来，**继续复用** `mat('steel')` / `mat('machine')`，不要为每个 Mesh `new MeshStandardMaterial`。
