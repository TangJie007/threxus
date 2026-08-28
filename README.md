# Threxus

为 Three.js 打造的依赖注入框架。

**实现顺序与完成标准**见 [docs/roadmap.md](./docs/roadmap.md)。

依赖约定：`@threxus/core` 仅适量使用可 tree-shake 的工具（当前为
`es-toolkit`），代码里必须 **具名导入**，禁止 `import *`。

## 项目结构

```text
packages/
  core/       @threxus/core —— Token / Module / Container / Lifecycle / Scope
  runtime/    @threxus/runtime —— Application + rAF + 约定 Token
  three/      @threxus/three —— ThreeCoreModule / RenderSystem
  vue/        @threxus/vue —— useThrexus 薄适配
examples/
  vue3/       Vue 3 + canvas 旋转立方体（开发调试）
```

## 开始使用

需要 Node.js `>=22.12.0` 与 pnpm `11.24.0`。

```bash
pnpm install
pnpm dev
```

示例 Vite 会 alias 到各包 `src`，改 `packages/*/src` 即可热更新。

正式构建：

```bash
pnpm build
pnpm --filter vue3-example build
```

## 常用命令

```bash
pnpm build       # Turbo 构建所有工作区包
pnpm typecheck   # Turbo 类型检查
pnpm test        # Turbo 测试
pnpm dev         # 并行库 watch + 示例开发服务器
```
