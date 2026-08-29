# FactoryTwin · 智能工厂数字孪生

> 一个**工业级** Three.js 训练项目。不是玩具 Demo，是按真实交付标准写的：
> 完整的工程分层、性能预算、资源生命周期、可观测性、可替换的数据层。
>
> **零外部素材依赖** —— 场景、材质、环境贴图全部程序化生成，clone 下来 `npm i && npm run dev` 直接出效果。

技术栈：Three.js **0.185.1** · TypeScript（strict） · Vite 6 · lil-gui

---

## 一、先看效果

```bash
npm install
npm run dev        # http://localhost:5173
```

| 操作 | 效果 |
|---|---|
| 左键拖拽 / 滚轮 / 右键拖拽 | 环绕 / 缩放 / 平移 |
| 点击设备或左侧列表 | 相机平滑飞入 + 描边 + 地面扫描圈定位 |
| 底部工具条 | 实时开关 描边 / 辉光 / AO / 流向 / 围栏 / 剖切 / 标签 |
| 右侧调试台 | 曝光、色调映射、像素比、光照、阴影、Bloom/AO/OGTAO 全部实时调参 |
| 快捷键 `Esc` `R` `P` | 取消选中 / 切换巡检模式 / 导出截图 |
| 控制台 `__twin` | 直接访问所有模块，随手试验 |

冒烟验证（真实浏览器跑一遍，抓 shader 编译错误）：

```bash
npm run build && npm run preview   # 另开一个终端
npm run smoke
```

---

## 二、为什么选「数字孪生」作为训练载体

它同时命中了 Three.js 的全部难点，学完一个项目等于覆盖 80% 的工业可视化需求：

| 能力维度 | 数字孪生里的具体挑战 |
|---|---|
| 规模 | 上千个构件、Draw Call 必须压到几百 |
| 材质 | PBR + 环境反射，金属不能是黑块 |
| 光照 | 阴影范围大，shadow acne 和精度难两全 |
| 后处理 | AO / 辉光 / 描边 / 抗锯齿的顺序与色彩空间 |
| 交互 | 大量物体的拾取、遮挡剔除、标签管理 |
| 数据 | 毫秒级推送驱动画面，不能卡渲染 |
| 稳定性 | 7×24 常亮，内存泄漏和上下文丢失必须能扛 |

---

## 三、8 个训练模块

每个模块都对应真实代码文件。建议**按序号推进**，每读完一个模块就去做它的「动手任务」。

### 模块 1 · 工程骨架与渲染管线

| 代码 | 学什么 |
|---|---|
| `src/core/Viewer.ts` | 渲染器配置、色彩管理、渲染循环、Resize、完整 dispose |

关键点：

- **色彩管理三件套**（缺一个画面就发灰）：`outputColorSpace = SRGBColorSpace`、
  `toneMapping = ACESFilmicToneMapping`、`ColorManagement` 默认开启
- **delta 必须钳住**：`Math.min(delta, 0.1)`，否则切后台回来物体会瞬移。
  0.185 起推荐用 `THREE.Timer`，它内置 Page Visibility 保护
- **dispose 是纪律不是选项**：几何体、材质、贴图、渲染上下文、`forceContextLoss()` 一个都不能少
- **按需渲染**：静态看板打开 `onDemand`，GPU 占用直接归零

> 🔥 动手任务：打开 `onDemand: true`，然后点工具条任意开关，观察画面是否更新。
> 你会发现开关失效了 —— 这就是按需渲染最坑的地方，想明白为什么，然后修好它。

---

### 模块 2 · 场景构建与性能优化

| 代码 | 学什么 |
|---|---|
| `src/scene/Factory.ts` | 几何合并、实例化、LOD、共享材质、静态矩阵冻结 |

这是本项目**内功最密集**的文件，集中演示 5 个工业级技巧：

| 技巧 | 位置 | 效果 |
|---|---|---|
| `mergeGeometries` | `buildStructure()` | 35 个钢构件 → **1 个** Draw Call |
| `InstancedMesh` | `buildShelves()` | 54 个货箱 → **1 个** Draw Call |
| `InstancedMesh.setColorAt` | `buildShelves()` | 逐实例染色（物料批次区分） |
| `LOD` | `buildStation()` | 设备按距离切三档精度 |
| `matrixAutoUpdate = false` | `buildStructure()` | 静态物体不重算矩阵 |

实测基线（详见第五节）：基础渲染仅 **132 Draw Call / 4.5 万三角面**，
而场景里有 15 根立柱、54 个货箱、60 个托辊、40 个支腿 ——
不做优化的话这些数字会翻 10 倍。

> 🔥 动手任务：把 `buildShelves()` 的 `InstancedMesh` 改成 54 个独立 `Mesh`，
> 用底部状态条对比 Draw Call 变化。

---

### 模块 3 · 材质、光照与环境反射

| 代码 | 学什么 |
|---|---|
| `src/materials/Presets.ts` | PBR 材质库、金属度纪律、`toneMapped: false` |
| `src/materials/ProceduralTextures.ts` | Canvas 程序化贴图、Sobel 生成法线图 |
| `src/scene/Environment.ts` | 程序化环境贴图、PMREM、阴影相机调优 |

最容易踩的三个坑：

1. **金属件发黑** —— 没有环境贴图。`scene.environment` + PMREM 是唯一解
2. **金属度滥用** —— 物理正确的 metalness 只有 0 或 1。涂装钣金是 **0.25**（涂层是非金属），
   裸钢才是 1.0
3. **Bloom 没效果** —— 材质默认被 tone mapping 压到 1.0 以内。
   自发光材质必须 `toneMapped = false`，亮度才能冲破阈值被 Bloom 提取

`ProceduralTextures.ts` 里的 `heightToNormal()` 值得逐行读 ——
用 **Sobel 算子**从灰度高度图求导生成切线空间法线贴图，
这是"没有素材也要让平面有起伏"的标准解法。

> 🔥 动手任务：删掉 `scene.environment`，观察所有金属件变成什么样子。
> 再把 `environmentIntensity` 从 0.85 调到 2.0，理解它对整体质感的支配力。

---

### 模块 4 · 后处理管线

| 代码 | 学什么 |
|---|---|
| `src/core/Composer.ts` | Pass 顺序、`HalfFloatType`、色彩空间收尾 |

Pass 顺序是有物理含义的，**不是随便排的**：

```
RenderPass → GTAO → Bloom → Outline → FXAA → OutputPass
```

| Pass | 为什么在这个位置 |
|---|---|
| GTAO | 紧跟 RenderPass，它要自己重建法线/深度 G-Buffer |
| Bloom | 在 AO 之后，否则辉光会把 AO 压暗的暗部洗掉 |
| Outline | 在 Bloom 之后，选中描边必须锐利 |
| FXAA | 在 sRGB 编码前的**线性空间**做抗锯齿 |
| OutputPass | **永远最后** —— 它负责 tone mapping + sRGB 编码 |

两个必须记住的事实：

- 渲染到 RenderTarget 时，材质里的 tone mapping 是**关闭的**（见 `WebGLPrograms.js` 源码），
  全靠 `OutputPass` 收尾
- Composer 的 RenderTarget 必须是 `HalfFloatType`，否则 HDR 值被截断，Bloom 提不出高光

> 🔥 动手任务：把 `OutputPass` 移到第一个，观察画面变灰。再把它删掉，观察画面过曝。

---

### 模块 5 · 交互与拾取

| 代码 | 学什么 |
|---|---|
| `src/core/Picker.ts` | Layers 分层、每帧一次 raycast、逻辑对象上溯 |
| `src/interaction/Labels.ts` | CSS2D 标签、遮挡剔除、距离淡出 |
| `src/interaction/CameraRig.ts` | 平滑飞入、巡检巡航、运镜与输入互斥 |

三个工业场景的必踩坑：

1. **pointermove 一帧触发上百次** —— 直接在回调里 raycast 必卡。
   正解：只记录坐标，raycast 放到渲染循环里，一帧最多一次
2. **`layers.set(1)` 会让物体隐形** —— `set` 是覆盖，会把默认的第 0 层关掉，
   而相机默认只看第 0 层。必须用 **`layers.enable(1)`** 追加
3. **点击与拖拽要区分** —— 用位移阈值（本项目 5px），否则转完相机松手会误触发点击

标签为什么用 CSS2D 不用 Sprite：文字永远清晰、能直接用 CSS 和 DOM 事件、不占显存。

> 🔥 动手任务：给标签加上「被遮挡时显示轮廓」的效果（提示：raycast 命中被遮挡物体后，
> 用 `OutlinePass` 单独描边它）。

---

### 模块 6 · 自定义 Shader 特效

| 代码 | 学什么 |
|---|---|
| `src/fx/shaders.ts` | 可复用 GLSL 片段（噪声 / 菲涅尔 / HSV / 抗锯齿条纹） |
| `src/fx/FlowPipe.ts` | TubeGeometry UV 流动、菲涅尔边缘光 |
| `src/fx/ScanRing.ts` | 距离场多环扫描、`discard` 早退 |
| `src/fx/ElectricFence.ts` | 六边形网格 SDF、剖切平面 |

值得单独拎出来的技巧：

- **流动效果零贴图依赖**：`fract(uv.x * count - time * speed)` 就够了
- **`fwidth()` 自适应抗锯齿**：远处的流动带不会变成闪烁的摩尔纹
- **`discard` 早退**：全屏平面上大部分像素 alpha≈0，直接丢弃能省掉大量无意义混合
- **六边形网格 SDF**：比方格纹更有"科技防护"感，且相邻面纹路天然连续

> 🔥 动手任务：给 `FlowPipe` 加一个 `uProgress` uniform，
> 实现"介质按批次分段推进"的效果（模拟真实管输的批次间隔）。

---

### 模块 7 · 数据驱动与状态联动

| 代码 | 学什么 |
|---|---|
| `src/data/devices.ts` | 遥测源抽象（`TelemetrySource` 接口）、Mock 与 WebSocket 同契约 |
| `src/ui/Dashboard.ts` | 3D ↔ 2D 单向数据流、DOM 更新节流 |

工业项目的铁律：

- **数据频率 ≠ 帧率**。遥测 1Hz 推送，渲染 60fps。
  绝不能在数据回调里直接改材质，只更新内存状态，由渲染循环统一消费
- **数据源必须可替换**。`MockTelemetry` 和 `WebSocketTelemetry` 实现同一个接口，
  上线时换实现类，业务代码零改动
- **DOM 更新要节流**。每帧写 DOM 或读布局属性（`offsetWidth`）会触发强制同步布局

> 🔥 动手任务：把 `MockTelemetry` 换成 `WebSocketTelemetry`，
> 用一个本地 WS 服务推真实数据（接口契约已在代码里定义好）。

---

### 模块 8 · 性能工程与可观测性

| 工具 | 用途 |
|---|---|
| 底部状态条 | FPS / Draw Call / 三角面 / Geometry / Texture 实时监控 |
| `scripts/smoke-test.mjs` | 真实浏览器抓 shader 编译错误和运行时异常 |
| lil-gui 调试台 | 现场实施时给客户实时调参 |

**本项目踩过并修复的真实陷阱**（每一条都能省你半天）：

| 现象 | 根因 | 修复 |
|---|---|---|
| Draw Call 永远显示 1 | 用了 Composer 后，`info.autoReset` 让统计被最后一个全屏 Pass 覆盖 | `info.autoReset = false` + 帧首手动 `reset()` |
| 状态条全是 0 | 在 updater 里读 `info`，但那时还没渲染 | 改到 `onAfterUpdate` 钩子（渲染后）读 |
| 场景「能拾取但看不见」 | `layers.set(1)` 关掉了第 0 层 | 改用 `layers.enable(1)` |
| HMR 几十次后崩溃 | GPU 资源没释放 | `main.ts` 末尾的 `teardown()` 全量释放 |

> 🔥 动手任务：连续开关剖切 20 次，观察 Geometry 数是否持续增长
> （如果涨了，说明 `needsUpdate` 触发的重编译没被正确回收）。

---

## 四、性能实测数据

在 SwiftShader 软件光栅化下实测（真实 GPU 上帧率会高得多，但 Draw Call 数量不变）：

| 配置 | Draw Call | 三角面 | 说明 |
|---|---:|---:|---|
| **全开（默认）** | 378 | 212.8K | GTAO + Bloom + Outline + FXAA + 阴影 + **63 个 glTF 实例** |
| 关 GTAO | ~190 | ~110K | **省 188 次调用** |
| **仅基础渲染** | ~132 | ~45K | 场景本体 + 阴影 |

**加入 63 个 glTF 模型实例（45 个输送带模块 + 18 个电控柜 + 6 个机械臂 + 1 个 AGV）后，
Draw Call 只增加 7 个（371 → 378）** —— 因为 `src/scene/ModelAssets.ts` 的
`instanceSubtree()` 把 glTF 子树"炸开"成 InstancedMesh。如果不实例化直接 clone，
Draw Call 会从 371 暴涨到 600+。

**GTAO 仍是整条管线最贵的一环**，占总开销约 50%。

优化决策建议：

| 场景 | 建议 |
|---|---|
| 高端工作站 / 单机演示 | 保留 GTAO，质量优先 |
| 大屏常亮 / 多实例同开 | 关 GTAO，改用建模阶段烘焙的 AO 贴图 |
| 移动端 / 弱显卡 | 只留 Bloom + FXAA，关阴影 |

---

## 五、目录结构

```
src/
├── core/                  引擎层（与业务无关，可直接复用到任何项目）
│   ├── Viewer.ts          ★ 渲染器 / 循环 / Resize / dispose / 按需渲染
│   ├── Resources.ts       ★ 资源中心（DRACO + KTX2 + Meshopt，URL 级缓存）
│   ├── Composer.ts        ★ 后处理管线
│   └── Picker.ts          ★ 射线拾取（分层 + 实例化反查 + 逻辑对象上溯）
├── scene/
│   ├── Factory.ts         ★ 程序化工厂（合并 / 实例化 / LOD / 动画）
│   ├── Environment.ts     ★ 程序化环境贴图 + 光照 + 阴影相机
│   └── ModelAssets.ts     ★ glTF 加载 + 模型实例化（glTF 子树 → InstancedMesh）
├── materials/
│   ├── Presets.ts         ★ PBR 材质库（全局共享，仅 10 个实例）
│   └── ProceduralTextures.ts  ★ Canvas 程序化贴图 + Sobel 法线图
├── fx/
│   ├── shaders.ts         可复用 GLSL 片段
│   ├── FlowPipe.ts        管道流动
│   ├── ScanRing.ts        地面扫描 + 告警光柱
│   └── ElectricFence.ts   电子围栏 + 剖切控制
├── interaction/
│   ├── Labels.ts          CSS2D 标签（遮挡剔除 + 距离淡出）
│   └── CameraRig.ts       平滑飞入 + 巡检巡航
├── data/devices.ts        遥测源抽象（Mock / WebSocket 同契约）
├── ui/
│   ├── Dashboard.ts       2D 看板（单向数据流）
│   └── Debug.ts           lil-gui 调试台
└── main.ts                组装 + 异步 boot 模式 + 生命周期

scripts/
├── smoke-test.mjs         浏览器冒烟测试（抓 shader 编译错误）
├── generate-assets.mjs    程序化 glTF 生成器（产出随项目 ship 的 4 个模型）
└── optimize-assets.mjs    素材优化流水线（减面 / 合并 / KTX2 / Draco）
```

★ = 建议精读的文件

---

## 六、学习路线建议

| 阶段 | 目标 | 对应模块 | 产出标准 |
|---|---|---|---|
| 第 1 周 | 跑通 + 读懂架构 | 1、2 | 能说清每一帧都发生了什么 |
| 第 2 周 | 材质与光照 | 3 | 能独立调出「不塑料」的工业质感 |
| 第 3 周 | 后处理与特效 | 4、6 | 能手写 ShaderMaterial 并接入 Composer |
| 第 4 周 | 交互与数据 | 5、7 | 能接真实 WebSocket 并驱动画面 |
| 第 5 周 | 性能与工程化 | 8 | 能把 Draw Call 压进预算，无内存泄漏 |

每阶段结束做一次 `npm run smoke`，确保没有引入运行时错误。

---

## 七、素材准备

见 **[ASSETS.md](./ASSETS.md)** —— 包含免费可商用素材来源、优化流水线命令、
CAD→glTF 转换踩坑、性能验收红线，以及常见问题的速查表。

一句话总结本项目的策略：**程序化生成兜底（离线可跑）+ 真实素材可插拔（生产可用）**。

---

## 八、已知的三个 API 变更（three 0.185）

本项目已全部适配，你在看旧教程时要注意这些已经变了：

| 旧写法 | 新写法 |
|---|---|
| `THREE.Clock` | `THREE.Timer`（内置 Page Visibility 保护） |
| `RGBELoader` | `HDRLoader` |
| `PCFSoftShadowMap` | `PCFShadowMap` |
| 手动拷贝 `public/draco/` | **不需要** —— three 已通过 `import.meta.url` 自动打包解码器 |
| 顶层 `await` 加载模型 | **绝对不要** —— module script 是 defer 的，会挂住 load 事件和 rAF。要用异步 boot 函数（见 `main.ts`） |

---

## 许可

代码可自由使用。程序化生成的素材无版权问题；外部素材请遵循各自来源的许可协议（推荐 CC0）。
