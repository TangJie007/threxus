---
layout: home
title: Threxus
titleTemplate: Three.js Feature Runtime

hero:
  name: Threxus
  text: Feature 导向的 Three.js 运行时
  tagline: 保留原生 Three.js 对象模型，用 Feature / 服务 / 结构化销毁管好生命周期。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 核心概念
      link: /guide/concepts
    - theme: alt
      text: API 参考
      link: /api/create-three-app

features:
  - title: Feature 微内核
    details: 声明式依赖图、拓扑安装、失败回滚与 LIFO 清理，避免 Viewer 巨类。
  - title: 资产所有权
    details: Texture / GLTF / HDR→PMREM 缓存与引用计数；DRACO / KTX2 / Meshopt 开箱可用。
  - title: 输入与渲染扩展
    details: 作用域 Pointer、pickId、drag；RenderPipeline、EffectComposer、Context restore。
  - title: 工业向内置能力
    details: Environment、Orbit、CameraRig、Selection、Outline、Labels、Quality、Stats。
---
