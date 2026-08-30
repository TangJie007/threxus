# Vue3 `/cube` 示例

路径：`examples/vue3/src/views/cube/`

演示内容：

- M6/M7：贴图立方体 + GLTF 多实例
- M8：Pointer hover / click + `markPickable`
- M9：overlay RenderStage
- M10：模拟 Context lost / restore
- M11+：environment（RoomEnvironment）、orbit、cameraRig flyTo、EffectComposer（GTAO/Bloom/Outline）、selection + outline + highlight、labels、stats、quality
- M12：`createLogger` + `inspectRuntime` 面板

## 运行

```bash
pnpm --dir examples/vue3 dev
```

浏览器打开 `/cube`。

## Feature 组合（摘录）

```ts
runtime.use(environmentFeature({ roomEnvironment: true, /* ... */ }));
runtime.use(orbitControlsFeature({ damping: true }));
runtime.use(cameraRigFeature());
runtime.use(effectComposerFeature({ gtao: true, bloom: true, outline: true }));
runtime.use(selectionFeature());
runtime.use(selectionOutlineFeature());
runtime.use(highlightFeature());
runtime.use(qualityFeature({ initialTierId: 'medium', auto: { enabled: true } }));
runtime.use(statsFeature({ sampleEverySeconds: 0.25 }));
runtime.use(labelsFeature({ maxDistance: 40 }));
```

选中物体时 demo-bridge 会调用 `CameraRigService.flyTo`，并刷新 CSS2D 标签。
