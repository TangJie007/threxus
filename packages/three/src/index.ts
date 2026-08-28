/**
 * `@threxus/three` 公共出口。
 *
 * Three 约定：`Scene` / `WebGLRenderer` 以类本身为 Token；
 * 相机请优先注入 {@link CameraSystem}（`PerspectiveCamera` Token 仍指向主相机以兼容旧写法）。
 */

export { CameraSystem, RenderSystem, ResizeSystem } from './systems';
export { ThreeCoreModule } from './module';
