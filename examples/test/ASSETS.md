# 素材准备手册

> 本项目的核心设计决策：**零外部素材依赖 + 自带一套可生成的 glTF 素材。**
> `npm install` 之后你就能看到完整的工厂数字孪生，包括真正从 .glb 文件加载的
> 工业机器人、输送带模块、电控柜和 AGV —— 这套模型随项目一起 ship。
> 真实项目要替换为甲方模型时，用 `scripts/optimize-assets.mjs` 优化流水线处理。
> 这份手册讲清五件事：**已带什么 → 怎么重新生成 → 去哪找 → 怎么转 → 怎么验**。

---

## 〇、本项目自带的 glTF 素材

放在 `public/assets/models/`，合计 **97 KB**（4 个 .glb）：

| 文件 | 模型 | 面数 | 材质数 | 节点数 | 体积 |
|---|---|---:|---:|---:|---:|
| `robot-arm.glb` | 六轴机器人 | 584 | 7 | 12 | 32 KB |
| `conveyor.glb` | 4 米输送带模块 | 544 | 4 | 5 | 28 KB |
| `cabinet.glb` | 电控柜 | 288 | 5 | 6 | 19 KB |
| `agv.glb` | AGV 运输车 | 328 | 5 | 7 | 19 KB |

**关键设计 —— 机器人是按关节拆节点的**（`Base` → `J1_Shoulder` → `J2_UpperArm`
→ `J3_ForeArm` → `Tool`），不是 merge 成一个 mesh。这是为了让运行时能通过
`getObjectByName('J1_Shoulder')` 拿到关节单独做动画。
如果建模时把所有零件合并，模型就"死"了 —— 只能整体移动，永远做不出真正的机器人动作。

## 一、素材预算（先定指标，再找素材）

---

## 一、素材预算（先定指标，再找素材）

工业数字孪生的性能红线，找素材时就按这个卡：

| 指标 | 红线 | 说明 |
|---|---|---|
| 单设备面数 | ≤ 50,000 tris | 超过就用 `gltfpack -si` 简化 |
| 全场总面数 | ≤ 3,000,000 tris | 中端独显 60fps 上限 |
| Draw Call | ≤ 300 | 超了必须做合批/实例化 |
| 单贴图尺寸 | ≤ 2048×2048 | 优先 1024 |
| 单模型文件 | ≤ 5 MB | 走 Draco + KTX2 后通常能压到 1/8 |
| 首屏加载 | ≤ 5 s（内网） | 大模型用 Meshopt 渐进加载 |
| 材质种类 | ≤ 20 个 PBR 材质 | 材质越多 shader 编译越慢 |

### 本项目实测基线

SwiftShader 软件光栅化下实测（真实 GPU 帧率更高，但 Draw Call 数量不变）：

| 配置 | Draw Call | 三角面 |
|---|---:|---:|
| **全开（默认）** | 378 | 212.8K |
| 关 GTAO | ~190 | ~110K |
| **仅基础渲染** | ~132 | ~45K |

加入 63 个 glTF 模型实例后（45 个输送带模块 + 18 个电控柜 + 6 个机械臂 + 1 个 AGV），
Draw Call 只增加 7 个（371 → 378），靠的是 `src/scene/ModelAssets.ts` 的
**`instanceSubtree()` 把 glTF 子树"炸开"成 InstancedMesh**。如果不实例化直接 clone，
Draw Call 会从 371 暴涨到 600+。

场景里有 15 根立柱、54 个货箱、60 个托辊、40 个支腿、18 台设备 ——
不做几何合并和实例化，这些数字会翻 10 倍。

**注意**：GTAO 一项就占总开销的 49%，因为它要把整个场景重渲染一遍生成 G-Buffer。
大屏常亮场景建议关掉它，改用建模阶段烘焙的 AO 贴图。

SwiftShader 软件光栅化下实测（真实 GPU 帧率更高，但 Draw Call 数量不变）：

| 配置 | Draw Call | 三角面 |
|---|---:|---:|
| **全开（默认）** | 371 | 97,667 |
| 关 GTAO | 190 | 48,807 |
| **仅基础渲染** | 132 | 45,073 |

场景里有 15 根立柱、54 个货箱、60 个托辊、40 个支腿、18 台设备 ——
不做几何合并和实例化，这些数字会翻 10 倍。详见 [README 第四节](./README.md#四性能实测数据)。

**注意**：GTAO 一项就占总开销的 49%（181 次调用），因为它要把整个场景重渲染一遍生成 G-Buffer。
大屏常亮场景建议关掉它，改用建模阶段烘焙的 AO 贴图。

---

## 二、去哪找（全部免费可商用）

### 模型

| 来源 | 特点 | 适合 |
|---|---|---|
| [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | 官方标准测试模型，格式最规范 | 验证管线、学格式 |
| [Sketchfab](https://sketchfab.com/search?licenses=322a749bcfa841b29dff1e8a1bb74b0b) （筛 CC0） | 量最大，工业设备不少 | 场景配景 |
| [Poly Haven](https://polyhaven.com/models) | CC0，质量高 | 设备、工具 |
| [AmbientCG](https://ambientcg.com/) | CC0，PBR 贴图为主 | 材质扫描件 |
| 甲方/设计院导出 | **真实项目的主要来源** | 见下方"CAD 转换" |

### HDRI 环境贴图

| 来源 | 推荐 |
|---|---|
| [Poly Haven HDRI](https://polyhaven.com/hdris) | 首选，`1k` 就够，`2k` 只在特写时用 |
| [AmbientCG](https://ambientcg.com/view?id=HDROutdoor) | 备用 |

工业场景选 HDRI 的要点：**室内厂房类**（indoor hall / warehouse）比室外天空更合适 ——
室外 HDRI 的太阳会在金属上打出过曝的高光斑，反而失真。

### PBR 贴图

[AmbientCG](https://ambientcg.com/) 一家基本够用，常见工业表面（金属、混凝土、油漆、橡胶）都有 1K–8K 全套 map。

---

## 三、怎么转（优化流水线）

### 3.1 安装工具

```bash
# gltf-transform：格式转换、压缩、检查（Node 生态，主力工具）
npm i -D @gltf-transform/cli

# gltfpack：几何简化 + Meshopt 压缩（C 编译的二进制，速度极快）
npm i -D gltfpack
```

### 3.1.5 程序化生成 glTF（本项目已自带脚本）

如果你拿不到合适的模型，或者需要快速搭原型，用 `scripts/generate-assets.mjs`
可以直接用 Three.js 构造几何体 → 用 gltf-transform 写出真正的 .glb 文件：

```bash
# 生成全部 4 个模型到 public/assets/models/
node scripts/generate-assets.mjs

# 只生成某一个
node scripts/generate-assets.mjs robot-arm

# 输出到其他目录（用于对比验证）
node scripts/generate-assets.mjs --out /tmp/test-glb
```

脚本里手工做了两个常被忽略的优化：
- **不导出 UV**：这些模型用纯 PBR 参数（无贴图），UV 是死重量，直接省 25%
- **顶点数 < 65536 时用 Uint16 索引**：索引数据再省 50%

实测：4 个模型共 1744 面，**97 KB**（同等级商业 glTF 通常是 300~500 KB）。
更强的优化（顶点量化、Draco 压缩）需要额外装 `@gltf-transform/functions`，
本项目用 `npx @gltf-transform/cli` 在另一条流水线上做（见 3.2）。

### 3.2 一键优化脚本

本项目已提供 `scripts/optimize-assets.mjs`：

```bash
node scripts/optimize-assets.mjs public/assets/models/raw/robot.glb \
  --out public/assets/models/robot.glb \
  --ratio 0.6 \      # 保留 60% 三角面
  --texture 1024     # 贴图最长边压到 1024
```

脚本内部等价于这条命令链：

```bash
# 完整手动流程（想理解每一步时用这个）
npx gltf-transform optimize input.glb output.glb \
  --compress draco \        # 几何压缩（或 meshopt）
  --texture-compress ktx2 \ # 纹理 GPU 压缩
  --texture-size 1024 \     # 贴图降尺寸
  --prune                   # 删除未被引用的 mesh/material/texture

# gltfpack 版（简化能力更强，速度更快）
npx gltfpack -i input.glb -o output.glb \
  -cc \        # 合并同材质 mesh（大幅降 Draw Call）
  -kn -km \    # 保留名称/材质
  -si 0.6 \    # 简化到 60% 面数
  -tc \        # 纹理转 KTX2
  -tcq 8       # KTX2 质量（0-255，工业场景 8 足够）
```

### 3.3 格式怎么选

| 决策点 | 选 A | 选 B | 结论 |
|---|---|---|---|
| 容器 | `.glb`（单文件二进制） | `.gltf` + 外链 | **用 .glb**，少请求、无路径坑 |
| 几何压缩 | Draco | Meshopt | **Draco** 体积小；**Meshopt** 解压快 10 倍。<br>首屏关键模型用 Meshopt，配景用 Draco |
| 纹理压缩 | KTX2 (Basis) | WebP / PNG | **KTX2**。显存只占 1/4，且免解码直接送 GPU。<br>唯一缺点：需要 Basis 转码器（three 已内置打包） |
| 纹理色彩空间 | sRGB（颜色贴图） | Linear（法线/粗糙度/金属度/AO） | **必须分开设**。搞混了整个 PBR 就废了 —— 见 `src/core/Resources.ts` 的 `loadTexture` |

### 3.4 CAD → glTF（真实项目最常见的坑）

甲方给的通常是 `.step` / `.iges` / `.fbx` / Revit / SolidWorks 文件，必须转：

```
STEP/IGES ──► FreeCAD（开源）或 Blender ──► 减面 ──► glTF
FBX ──► Blender（推荐）或 fbx2gltf ──► glTF
Revit ──► Navisworks/FBX ──► Blender ──► glTF
```

**必经的三步处理（缺一不可）：**

1. **减面** —— CAD 导出面数动辄百万级，Blender 里用 `Decimate` 修改器压到 5 万以内
2. **重置变换** —— CAD 模型常带非均匀缩放，会导致法线错误。Blender 里 `Ctrl+A → Apply Scale`
3. **统一朝向与单位** —— glTF 标准是 **Y-up / 米**。Z-up 的 CAD 模型导入后要转 90°，
   否则设备会躺倒。本项目 `src/core/Resources.ts` 里没做自动纠正，需要你在建模阶段处理

---

## 四、怎么验

优化完必须验证，不能只看文件大小：

```bash
# 1) 结构体检：看面数、材质数、贴图数、是否有未使用资源
npx gltf-transform inspect output.glb

# 2) 浏览器实测：本项目首页底部状态条直接看 Draw Call / 三角面 / Geometry / Texture 数量
#    加载模型后如果 Geometry 数暴涨，说明实例化没生效

# 3) 显存估算：
#    显存 ≈ 三角面数 × 48 bytes + 贴图数 × 宽 × 高 × 4 bytes × 1.33(mipmap)
#    例：100 万面 + 20 张 1024² 贴图 ≈ 48MB + 111MB ≈ 160MB
```

---

## 五、放进本项目

### HDRI

```bash
# 从 Poly Haven 下一个 1K 的室内厂房 HDRI
cp ~/Downloads/warehouse_1k.hdr public/assets/hdri/factory_hall_1k.hdr
```

然后改 `src/main.ts`：

```ts
const HDRI_URL: string | null = 'assets/hdri/factory_hall_1k.hdr'
```

加载失败会自动回退到程序化环境，不会白屏。

### 设备模型

用 `Resources.loadGLTF()` 加载，替换 `src/scene/Factory.ts` 里的 `buildStation()`：

```ts
const gltf = await resources.loadGLTF('assets/models/robot.glb')
const model = gltf.scene

// 四件套，缺一不可：
model.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) {
    o.castShadow = true
    o.receiveShadow = true
  }
})
markPickable(model)                    // ① 加入拾取层
model.userData.pickId = seed.id        // ② 标记逻辑对象
group.add(model)                       // ③ 挂到设备节点下
// ④ 在 dispose 时调用 disposeObject3D(model)
```

**注意**：glTF 加载是异步的，而 `Factory` 构造函数是同步的。
真实项目里应该改成 `await Factory.create(resources)` 工厂方法，
本项目为了让你能直接对比"程序化 vs 外部模型"两种路线，故意保留了同步构建。

---

## 六、程序化素材（本项目已实现，重点学习）

`src/materials/ProceduralTextures.ts` 里实现了完整的程序化贴图工厂：

| 函数 | 技术 | 产出 |
|---|---|---|
| `fbm()` | 分形叠加 value noise | 水泥、锈迹、塑料颗粒的基础 |
| `heightToNormal()` | **Sobel 算子** 从灰度高度图求导 | 切线空间法线贴图 |
| `concrete()` | 细颗粒 + 大块污渍 | map + normalMap + roughnessMap 三件套 |
| `brushedMetal()` | 水平随机线条 + 条纹噪声 | 拉丝金属 |
| `hazardStripes()` | Canvas 斜条绘制 | 安全通道 |
| `gridLines()` | Canvas 描边 | 地面基准网（比 GridHelper 抗锯齿好） |

**为什么值得学**：
- 内网/离线部署拿不到素材库，却依然要出效果
- 参数化生成能按设备尺寸自动调纹理密度，不会出现拉伸
- 一份代码生成无限变体，零下载体积

`src/scene/Environment.ts` 里的 `buildFactoryEnvScene()` 是同类思路的进阶版：
**用几块自发光 Mesh 搭一个虚拟房间，再用 PMREM 烘成环境贴图** ——
这是"没有 HDRI 文件也要让金属有正确反射"的标准解法。

---

## 七、常见坑速查

| 现象 | 原因 | 解决 |
|---|---|---|
| 模型能拾取但看不见 | `layers.set(1)` 关掉了默认第 0 层 | 用 `layers.enable(1)`，见 `src/core/Picker.ts` |
| 金属件发黑 | 没有环境贴图 | 设 `scene.environment`，或调 `envMapIntensity` |
| 整体发灰/发白 | 贴图色彩空间搞错 | 颜色贴图 sRGB，其余 Linear |
| 后处理后画面变灰 | 忘记加 `OutputPass`，或它不在最后 | `OutputPass` 必须最后一个 pass |
| Bloom 完全没效果 | 材质开了 `toneMapped`，亮度超不过 1.0 | 自发光材质设 `toneMapped = false` |
| 阴影出现条纹（shadow acne） | `shadow.bias` 不当 | 用极小的 bias + `normalBias ≈ 0.035` |
| 透明件挡住后面的物体 | 透明材质写了深度 | `depthWrite = false` + 调 `renderOrder` |
| 页面切走一会儿回来物体乱飞 | `delta` 暴涨 | `Math.min(clock.getDelta(), 0.1)` 钳住 |
| HMR 几十次后崩溃 | 没释放 GPU 资源 | 见 `main.ts` 末尾的 `teardown()` |
