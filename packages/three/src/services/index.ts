/**
 * 内置服务出口（L1 DI）。
 *
 * `SceneService` = Three 场景图（SceneGraph）；
 * 与 core `createSceneScope`（DI SceneScope）无关。
 */

export { AssetService, type AssetContext, type AssetLoader } from './asset-service';
export { CameraService } from './camera-service';
export { CommandService, type Command } from './command-service';
export { ComponentService } from './component-service';
export { ConfigService, type ThrexusConfig } from './config-service';
export { DisposeService } from './dispose-service';
export {
  AgentBridgeService,
  ClipboardService,
  GizmoService,
  HotkeyService,
  SnapshotService,
} from './editor-services';
export {
  InstancedFoliageService,
  type FoliageInstance,
} from './instanced-foliage-service';
export {
  InteractionService,
  type InteractionContext,
} from './interaction-service';
export { RenderService, type RenderContext } from './render-service';
export { ResizeService } from './resize-service';
export { SceneService } from './scene-service';
export { SelectionService } from './selection-service';
export {
  SerializeService,
  sceneDocumentSchema,
  sceneNodeSchema,
  type DeserializeContext,
  type SceneDocument,
  type SceneNodeData,
  type SerializeContext,
} from './serialize-service';
export { ViewportService } from './viewport-service';
