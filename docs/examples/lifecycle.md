# 生命周期演示

路径：`examples/vue3`

| 路由 | 内容 |
|------|------|
| `/` | Feature 依赖启动顺序与反向销毁 |
| `/factory-twin` | `setup` 失败时的部分回滚 |
| `/cube` | 综合能力演示 |

```bash
pnpm --dir examples/vue3 dev
pnpm --dir examples/vue3 test:e2e
```

E2E 断言覆盖 App 状态、事件日志与 `/cube` 关键关键。
