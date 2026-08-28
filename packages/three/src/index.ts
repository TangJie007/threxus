/**
 * `@threxus/three` 公共出口。
 *
 * 四层混合架构（DI 只管管理者，永远不管实体）：
 * - L1 DI 服务：Scene / Camera / Render / Dispose / EntityComponent 等单例
 * - L2 原生实体：Mesh / Object3D 普通对象，不进 DI；由 SceneService 增删、DisposeService 回收
 * - L3 轻量组件：挂在 Object3D.userData，由 EntityComponentService 每帧调度
 * - L4 中间件：纯函数横切（Render / Asset / Interaction / Serialize…）
 *
 * 心智模型：
 * - AppModule 组装功能模块
 * - FeatureModule + Service（可继承 {@link EntityHost}）spawn 一类 Entity
 * - Entity 为普通 class，持有 Mesh，不进 DI；行为优先用组件
 *
 * 场景 / 相机注入 {@link SceneService} / {@link CameraService}
 *（Three **场景图** SceneGraph）。
 *
 * 相机位姿用 {@link THREE_VIEWPORT} + {@link ViewportService}；
 * 勿与 core 的 DI **SceneScope**（`createSceneScope`）混淆。
 */

export {
  AgentBridgeService,
  AssetService,
  CameraService,
  ClipboardService,
  CommandService,
  ConfigService,
  DisposeService,
  EntityComponentService,
  GizmoService,
  HotkeyService,
  InstancedFoliageService,
  InteractionService,
  RenderService,
  ResizeService,
  SceneService,
  SelectionService,
  SerializeService,
  SnapshotService,
  ViewportService,
  sceneDocumentSchema,
  sceneNodeSchema,
} from './services';
export type {
  AssetContext,
  AssetLoader,
  Command,
  DeserializeContext,
  FoliageInstance,
  InteractionContext,
  RenderContext,
  SceneDocument,
  SceneNodeData,
  SerializeContext,
  ThrexusConfig,
} from './services';
export { EntityHost } from './entity';
export type { Component, ComponentMap } from './component';
export {
  createPipeline,
  type Middleware,
  type Next,
  type Pipeline,
} from './middleware';
export { disposeObject3D } from './utils';
export { THREE_VIEWPORT, type ViewportOptions } from './tokens';
export { ThreeCoreModule } from './module';
