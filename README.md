# Threxus

为 Three.js 打造的依赖注入框架。

**实现顺序与完成标准**见 [docs/roadmap.md](./docs/roadmap.md)。

## 项目结构

```text
packages/
  core/                 @threxus/core，使用 Rslib 编译
    src/
      token/            Token / createToken
      types/            Provider 与注入相关类型
      metadata/         Symbol.metadata 读写
      decorators/       @Injectable / @Inject
      module/           @Module / loadModule
      container/        Container
      errors/           ThrexusError 统一错误
      utils/            描述与辅助函数
    tests/              Vitest 单测
examples/
  vue3/                 边开发边调试的 playground
    src/usage.ts        改这里试 @threxus/core 用法
```

## 开始使用

需要 Node.js `>=22.12.0` 与 pnpm `11.24.0`。

```bash
pnpm install
pnpm dev
```

示例 Vite 会 **alias 到 `packages/core/src`**，改 core 源码或
`examples/vue3/src/usage.ts` 都会热更新。打开页面后看浏览器控制台。

正式发版构建仍用：

```bash
pnpm build
pnpm --filter vue3-example build
```

## 常用命令

```bash
pnpm build       # 通过 Turbo 构建所有工作区包（含缓存）
pnpm typecheck   # 通过 Turbo 检查类型
pnpm test        # 通过 Turbo 运行测试（含 @threxus/core）
pnpm dev         # 通过 Turbo 并行启动库监听与示例开发服务器
```
