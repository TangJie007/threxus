# 简介

Threxus（`@threxus/runtime`）是面向 **Feature** 与 **生命周期** 的 Three.js 轻量运行时。

它不替代 Three.js，也不做声明式场景树或 ECS。目标是：

> 任意 Feature 在成功、失败、取消和销毁时，都不遗留资源、回调或运行任务。

## 适合什么项目

- 工业孪生 / 看板 / 可视化中台
- 需要可靠 dispose、异步加载回滚的中大型 Three.js 应用
- 想用「组合 Feature」而不是巨型 `Viewer` 类组织代码

## 不做什么

第一版刻意不做：

- Vue / React 专用运行时（可自行薄封装）
- JSX 场景描述 / 自定义渲染器
- ECS、物理引擎、材质系统替代 Three.js
- 运行时热插拔任意 Feature 以外的复杂图重算（已提供受约束的 `installFeature`）

## 包与示例

| 路径 | 说明 |
|------|------|
| `packages/runtime` | `@threxus/runtime` |
| `examples/vue3` | `/` 生命周期、`/cube` 综合演示、`/factory-twin` 失败回滚 |
| `docs/` | 本站（VitePress） |

设计原稿：[THREEJS-ENCAPSULATION-DESIGN.md](https://github.com/threxus/threxus/blob/main/THREEJS-ENCAPSULATION-DESIGN.md)（仓库根目录）。
