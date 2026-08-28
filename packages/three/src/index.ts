/**
 * `@threxus/three` 公共出口。
 *
 * 心智模型：
 * - AppModule 组装功能模块
 * - FeatureModule + System（可继承 {@link EntityHost}）驱动一类 Entity
 * - Entity 为普通 class，持有 Mesh，不进 DI
 *
 * 场景 / 相机请优先注入 {@link SceneSystem} / {@link CameraSystem}
 *（Three **场景图** SceneGraph）；`Scene` / `PerspectiveCamera` Token
 * 仍指向各自 MAIN 以兼容旧写法。
 *
 * 相机位姿用 {@link THREE_VIEWPORT} + {@link ViewportSystem}；
 * 勿与 core 的 DI **SceneScope**（`createSceneScope`）混淆。
 */

export {
  CameraSystem,
  RenderSystem,
  ResizeSystem,
  SceneSystem,
  ViewportSystem,
} from './systems';
export { EntityHost, type HostEntity } from './entity';
export { disposeObject3D } from './utils';
export { THREE_VIEWPORT, type ViewportOptions } from './tokens';
export { ThreeCoreModule } from './module';
