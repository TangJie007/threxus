# 浏览器矩阵

CI / 手工验证目标：

| Browser | Status |
|---------|--------|
| Chrome (latest) | Required |
| Edge (latest) | Required |
| Firefox (latest) | Required |
| Safari (latest / iOS) | Required（macOS 手工） |

## Three.js peer

```text
three: >=0.180.0 <1
```

发版前建议在最低支持版本（`0.180.0`）与较新版本各跑一轮。

## Smoke

1. `pnpm --dir packages/runtime test`
2. `pnpm --dir packages/runtime test:browser`
3. `pnpm --dir examples/vue3 test:e2e`
4. 打开 `/cube`：轨道旋转、选中描边、Context 模拟、离开页 dispose

更细的示例覆盖表见仓库 `docs/BROWSER_MATRIX.md`（工程向）。
