/**
 * `@threxus/three` 公共出口。
 *
 * 四层混合架构（DI 只管管理者，永远不管实体）：
 * - L1 DI 服务：Scene / Camera / Render / Dispose / Component 等单例
 * - L2 原生对象：Mesh / Object3D，不进 DI；由 SceneService 增删、DisposeService 回收
 * - L3 轻量组件：挂在 Object3D.userData，由 ComponentService 每帧调度
 * - L4 中间件：纯函数横切（Render / Asset / Interaction / Serialize…）
 *
 * 心智模型：
 * - AppModule 组装功能模块
 * - FeatureModule + Feature（可继承 {@link ObjectHost}）spawn Mesh 并挂组件
 * - Mesh 不进 DI；行为用 Component
 *
 * 默认只 imports {@link ThreeCoreModule}；资源 / 交互 / 序列化 / 编辑器按需加可选 Module。
 */

export {
  AgentBridgeService,
  AssetService,
  CameraService,
  ClipboardService,
  CommandService,
  ComponentService,
  ConfigService,
  DisposeService,
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
export { ObjectHost, SceneObjectHost } from './host';
export type { Component, ComponentMap } from './component';
export {
  createPipeline,
  createSyncPipeline,
  type Middleware,
  type Next,
  type Pipeline,
  type SyncMiddleware,
  type SyncNext,
  type SyncPipeline,
} from './middleware';
export { disposeObject3D } from './utils';
export { THREE_VIEWPORT, type ViewportOptions } from './tokens';
export {
  ThreeAssetModule,
  ThreeCoreModule,
  ThreeEditorModule,
  ThreeInteractionModule,
  ThreeSerializeModule,
} from './module';
