# Threxus

为 Three.js 打造的依赖注入框架。

## 项目结构

```text
packages/
  core/                 @threxus/core，使用 Rslib 编译
    src/
      token/            Token / createToken
      types/            Provider 与注入相关类型
      metadata/         Symbol.metadata 读写
      decorators/       @Injectable / @Inject
      container/        Container
examples/
  vue3/                 Vue 3 + Vite 示例
```

## 开始使用

需要 Node.js `>=22.12.0` 与 pnpm `11.24.0`。

```bash
pnpm install
pnpm build
pnpm --filter vue3-example dev
```

访问终端输出的地址即可查看 Vue 3 示例。示例通过 `workspace:*` 使用本地
`@threxus/core` 包。

## 常用命令

```bash
pnpm build       # 通过 Turbo 构建所有工作区包（含缓存）
pnpm typecheck   # 通过 Turbo 检查类型
pnpm dev         # 通过 Turbo 并行启动库监听与示例开发服务器
```
