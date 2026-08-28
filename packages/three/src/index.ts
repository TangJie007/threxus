/**
 * `@threxus/three` 公共出口。
 *
 * Three 约定 Token 即 `three` 的类本身（`Scene` / `PerspectiveCamera` / `WebGLRenderer`），
 * 业务侧从 `three` 导入即可，本包不再二次导出。
 */

export { RenderSystem, ResizeSystem } from './systems';
export { ThreeCoreModule } from './module';
