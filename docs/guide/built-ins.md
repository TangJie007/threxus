# 内置 Feature

按常见组合使用：

```ts
app.use(environmentFeature({ background: '#0b1220', roomEnvironment: true }));
app.use(orbitControlsFeature({ damping: true }));
app.use(cameraRigFeature({ roamPath: [[-10, 5, 10], [10, 5, -10]] }));
app.use(effectComposerFeature({ outline: true, bloom: true }));
app.use(selectionFeature());
app.use(selectionOutlineFeature());
app.use(highlightFeature());
app.use(labelsFeature({ maxDistance: 60 }));
app.use(statsFeature({ sampleEverySeconds: 0.25 }));
app.use(qualityFeature({ initialTierId: 'medium', auto: { enabled: true } }));
```

## 一览

| Feature | 提供服务 | 说明 |
|---------|----------|------|
| `environmentFeature` | — | 背景、灯光、地面、HDRI / RoomEnvironment、阴影 |
| `orbitControlsFeature` | `CameraControlService` | OrbitControls |
| `cameraRigFeature` | `CameraRigService` | flyTo / roam（依赖 Orbit） |
| `postprocessingFeature` | `PostprocessingService` | 轻量 Pass 注册 |
| `effectComposerFeature` | `EffectComposerService` + Postprocessing | 完整 Composer |
| `selectionFeature` | `SelectionService` | 点击选中 |
| `selectionOutlineFeature` | — | Selection → OutlinePass |
| `highlightFeature` | — | emissive 高亮 |
| `labelsFeature` | `LabelsService` | CSS2D 标签 |
| `statsFeature` | `StatsService` | FPS / drawCalls 等 |
| `qualityFeature` | `QualityService` | 档位 + 自动降质 |

## CameraRig

```ts
const rig = ctx.inject(CameraRigService);
rig.flyTo([0, 0, 0], { distance: 12, height: 8, duration: 0.9 });
rig.setMode('roam'); // 需配置 roamPath
```

## Labels

```ts
const labels = ctx.inject(LabelsService);
labels.add({
  id: 'pump-1',
  anchor: mesh,
  element: el,
  offset: [0, 1.2, 0],
});
labels.setAll([...]); // 批量替换
```

距离剔除 / 遮挡：

```ts
labelsFeature({
  maxDistance: 75,
  occlusionRoots: [factoryRoot],
  occludedOpacity: 0.15,
});
```
