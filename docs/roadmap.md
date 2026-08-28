# Threxus 实现路线图

本文说明：**先做什么、后做什么**，从当前 DI 壳子一直做到「面向 Three.js 的应用框架」封装完成。

原则回顾：

- 学 Nest 的 **模块化 DI + 生命周期**，不照搬 HTTP / Controller。
- 装饰器用 **Stage 3**，**零第三方**（无 `reflect-metadata`）。
- 注入主路径：`@Injectable({ inject })`；辅路径：字段 `@Inject`。
- 默认场景：**一个应用一个 canvas**；App 级服务单例，场景服务按场景单例，Mesh 等多对象一般不进 DI。
- **先 core 稳定，再 three / 框架适配**；边开发边用 `examples/vue3/src/usage.ts` 调试。

---

## 总览

| 阶段 | 目标包 / 产物 | 完成标准（可勾选） |
|------|----------------|--------------------|
| 0 | `@threxus/core` 壳子 | ✅ 已完成 |
| 1 | Module | ✅ 已完成 |
| 2 | 测试与错误体验 | ✅ 已完成 |
| 3 | 生命周期 | ✅ 已完成 |
| 4 | 层级作用域 | ✅ 已完成 |
| 5 | `@threxus/runtime` | ✅ 已完成 |
| 6 | `@threxus/three` | ✅ 已完成 |
| 7 | 框架适配 | ✅ 已完成 |
| 8 | 打磨与发布 | 文档、示例场景、版本策略 |

**不要提前做：** 完整 Guard/Interceptor、把每个 `Mesh` 封成 Provider、多 canvas 叠加当默认模型。

---

## 阶段 0 — DI 壳子（已完成）

**位置：** `packages/core`

已具备：

- `createToken` / `Token`
- `@Injectable({ inject })`、`@Inject`
- `Container`：`register` / `set` / `get` / `resolve`
- Provider：`useValue` / `useClass` / `useFactory` / 类简写
- 单例缓存、循环依赖检测
- Stage 3 + `Symbol.metadata`，无第三方
- Playground：`examples/vue3`（Vite alias 到 core 源码）

调试方式：根目录 `pnpm dev` → 改 `usage.ts` 或 `packages/core/src/**`。

---

## 阶段 1 — Module（✅ 已完成）

**目标：** 从「能解析」升级到「能分域组装」。

### 1.1 设计约定（先定再写）

建议第一版采用：

```ts
@Module({
  imports: [OtherModule],
  providers: [Logger, Greeter, { provide: CLOCK, useValue: clock }],
  // exports 可选：不写 = providers 全部对外可见（降低早期样板）
  exports?: [...],
})
class AppModule {}
```

- `imports`：合并被导入模块的对外 provider。
- `exports`：**可选**；缺省等于导出全部 `providers`。出现「内部 Helper 不想泄漏」时再强制写 `exports`。
- 仍只有一个根 `Container`（层级容器放到阶段 4）。

### 1.2 实现清单

1. 增加 `packages/core/src/module/`（类型、`@Module`、元数据读写）。
2. `Container`（或 `ApplicationContext`）增加 `load(RootModule)`：递归处理 `imports`，注册 `providers`。
3. 处理模块图：重复 import、简单环检测。
4. 在 `usage.ts` 用 2～3 个 Module 跑通（例如 `CoreModule` + `FeatureModule`）。

### 1.3 完成标准

- [x] `@Module` + `load` 可用
- [x] `imports` 能拿到被导入模块的对外能力
- [x] playground 改为「模块组装」写法
- [x] 注释中文且完整

---

## 阶段 2 — 测试与 DX（✅ 已完成）

**目标：** API 开始定型前锁住行为，避免后面 Three 层返工。

### 2.1 实现清单

1. 为 `@threxus/core` 加测试运行器（任选 Vitest，保持依赖克制）。
2. 覆盖：Token、构造/字段注入、工厂、单例、循环依赖报错、Module import/export。
3. 统一错误文案（令牌名、模块名出现在消息里）。
4. CI 或根脚本：`pnpm test` + 现有 `typecheck` / `build`。

### 2.2 完成标准

- [x] 核心路径有自动化测试（`packages/core/tests`，Vitest）
- [x] 故意写错依赖时，报错能直接定位（`ThrexusError` + 稳定 `code`）

---

## 阶段 3 — 生命周期（✅ 已完成）

**目标：** 装配期与运行期分离；**热路径（每帧）零反射**。

### 3.1 建议钩子（先少后多）

| 钩子 | 时机 |
|------|------|
| `onModuleInit` | 模块 providers 注册并首次解析相关实例后 |
| `onApplicationBootstrap` | 根模块全部就绪 |
| `onUpdate(dt)` | 主循环每帧（仅收集到的实现者，扁平数组调用） |
| `onDispose` | 容器/场景销毁、释放资源 |

实现要点：

- 实现接口方法即可（`OnModuleInit` 等）；**`init()` 时扫描一次**并缓存。
- `onUpdate` 放入数组，`update(dt)` 内 `for` 循环调用；禁止每帧读 metadata。

### 3.2 完成标准

- [x] 能注册带 `onUpdate` 的服务并在 playground 用 `requestAnimationFrame` 打日志
- [x] `onDispose` 可手动触发并清理

---

## 阶段 4 — 层级作用域（App → Scene）（✅ 已完成）

**目标：** 对应真实 Three 用法——换关卡时丢掉场景层，保留画布层。

### 4.1 模型

```text
App Container（单例）
  Renderer / Clock / Input …   ← 常驻
  └─ Scene Child Container     ← 可销毁再建
       当前 Scene 专用 System / 状态
```

### 4.2 实现清单

1. `Container` 支持 `parent`：子找不到则向父查找。
2. `createSceneScope()` / `destroySceneScope()`（子容器亦有 `destroy`）：销毁子容器实例并调用 `onDispose`。
3. playground 演示：切换「场景 A / 场景 B」，App 级 Logger 仍在，场景服务被替换。

### 4.3 完成标准

- [x] 子作用域可覆盖父令牌（本地 Provider shadow 父级；见 `get` 查找顺序）
- [x] destroy 后不应再持有场景级实例引用
- [x] 仍默认单例语义（作用域内单例，不是每次 get 都 new）

---

## 阶段 5 — `@threxus/runtime`（应用运行时）（✅ 已完成）

**目标：** 与 Three 解耦的「应用壳」：启动、主循环、约定 Token。

新建包：`packages/runtime`（名称可定为 `@threxus/runtime`）。

### 5.1 能力

- `ThrexusApplication` / `createApplication(RootModule)`
- 启动：`load` 模块 → 生命周期 bootstrap → 启动 loop
- 约定 Token（字符串描述清晰即可）：如 `CLOCK`、`APPLICATION`、`CANVAS`（尚未绑 Three）
- 将实现了 `onUpdate` 的 provider 挂到 rAF

### 5.2 完成标准

- [x] playground 用 Application 启动，而不是手写 `createContainer().load`
- [x] 仍可不依赖 `three` 包

---

## 阶段 6 — `@threxus/three`（Three 对接）（✅ 已完成）

**目标：** 最小可用的 Three 封装，**不是**第二个引擎。

新建包：`packages/three`，peerDependency：`three`。

### 6.1 先做这些

1. 内置 Module：例如 `ThreeCoreModule`，提供：
   - `WEBGL_RENDERER`（或工厂：传入 canvas）
   - `SCENE`、默认 `CAMERA`（可覆盖）
2. 与 runtime 协作：resize、render 一次封装在某个 `RenderSystem.onUpdate`
3. dispose：renderer / geometry / material 的释放约定（文档 + 钩子）

### 6.2 明确不做（本阶段）

- 声明式 `<mesh>` 场景图（那是 R3F/Tres 路线）
- 物理、寻路、完整编辑器
- 多 WebGL 上下文默认方案

### 6.3 完成标准

- [x] 示例里出现一个 canvas，旋转立方体或等价最小场景
- [x] 切换 Scene 作用域时资源可释放（至少 renderer 外的场景对象；示例立方体在 `onDispose` 释放）

---

## 阶段 7 — 框架适配（Vue / React）（✅ 已完成）

**目标：** UI 框架只负责挂 DOM 与提供 canvas，**不**把 Threxus 做成第二个 Vue。

### 7.1 建议

- `@threxus/vue` 或先在 `examples/vue3` 内做 composable：`useThrexus(RootModule, canvasRef)`
- 挂载时 `createApplication`，卸载时 `dispose`
- React 同理（可更晚）

### 7.2 完成标准

- [x] Vue 示例：组件挂载出 Three 画面，卸载无泄漏（`useThrexus` 在 `onBeforeUnmount` dispose）

---

## 阶段 8 — 打磨与「封装完成」定义

### 8. 完成标准（部分已具备）

- [x] `@threxus/core`：Token、装饰器、Container、Module、生命周期、层级作用域
- [x] `@threxus/runtime`：Application + 主循环
- [x] `@threxus/three`：Renderer/Scene 约定 Module + 最小渲染
- [x] 至少一个完整示例（Vue + 单 canvas 场景）
- [x] README：快速开始 + 包结构
- [x] 构建、类型检查、核心测试通过
- [ ] 对外 API 有简短迁移/版本说明（SemVer：0.x 允许 break）

**v0.1 之后再考虑：** exports 强制模式、transient、插件生态、ECS 可选包、多 canvas 视口。

---

## 推荐执行顺序（墙上贴这一段）

```text
① Module（core）✅
② 单测 + 报错 DX（core）✅
③ 生命周期 onInit / onUpdate / onDispose（core）✅
④ App → Scene 子容器（core）✅
⑤ runtime：Application + rAF ✅
⑥ three：最小 Module + 示例出画 ✅
⑦ Vue 挂载/卸载适配 ✅
⑧ 文档与 v0.1 发布准备
```

每完成一阶段：先在 `usage.ts`（或后续 three 示例）跑通，再进入下一阶段。  
**禁止**跳过 ①～④ 直接大包 Three API。

---

## 包结构终态（预期）

```text
packages/
  core/        # DI：Token / Module / Container / Lifecycle / Scope
  runtime/     # Application、主循环、约定 Token（不依赖 three）
  three/       # Three 对接 Module 与 RenderSystem
  vue/         # 可选，薄适配
examples/
  vue3/        # 开发调试 + 最终最小 3D 示例
```

---

## 与当前仓库的衔接

| 现在就有 | 下一步 |
|----------|--------|
| `packages/{core,runtime,three,vue}` | 阶段 8：打磨 README / 版本与发布说明 |
| `examples/vue3` | 旋转立方体 + `useThrexus` |
| Vitest | core / runtime / three |

文档版本与代码同步维护：完成某阶段后，把上文对应勾选打成 `[x]`，并在 README「项目结构」中更新包列表。
