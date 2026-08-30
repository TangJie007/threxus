# 内置 Feature API

从 `@threxus/runtime` 导入同名工厂与服务 Key。

## environmentFeature(options?)

`background`、`ambientLight`、`directionalLight`、`ground`、`hdri`、`roomEnvironment`、`fallbackRoomEnvironment`、`shadows`

## orbitControlsFeature(options?)

→ `CameraControlService`：`controls` / `enabled` / `reset()`

## cameraRigFeature(options?)

→ `CameraRigService`：`flyTo` / `setMode` / `busy` / `mode`  
依赖 `CameraControlService`。`roamPath` 可选。

## effectComposerFeature(options?)

→ `EffectComposerService`、`PostprocessingService`、`RenderPipelineService`  
选项：`gtao`、`bloom`、`outline`、`fxaa`、`output`、`pipelineName`  
服务：`setOutlineSelected`、`setPassEnabled`、`isPassEnabled`

## postprocessingFeature(options?)

轻量 Pass 注册（非 EffectComposer）。

## selectionFeature(options?)

→ `SelectionService`：`select` / `deselect` / `clear` / `onChange` / `selected`

## selectionOutlineFeature()

依赖 Selection + EffectComposer（需 `outline: true`）。

## highlightFeature(options?)

依赖 Selection；修改 emissive。

## labelsFeature(options?)

→ `LabelsService`：`add` / `remove` / `clear` / `setAll` / `setVisible`  
选项：`maxDistance`、`occlusionRoots`、`occludedOpacity`、`container`

## statsFeature(options?)

→ `StatsService`：`latest` / `sample()`

## qualityFeature(options?)

→ `QualityService`：`setTier` / `setAuto` / `tierId` / `tiers`  
可选依赖 EffectComposer。
