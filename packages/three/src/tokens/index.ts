/**
 * `@threxus/three` 约定 Token。
 *
 * 注意命名：`SceneSystem` 管的是 Three **场景图**（SceneGraph）；
 * core 的 `createSceneScope` 管的是 DI **场景作用域**（SceneScope），二者不同。
 */

import { createToken } from '@threxus/core';

/**
 * 视口装配选项：相机位姿 / fov 等。
 *
 * 由 {@link ViewportSystem} 在 `onModuleInit` 应用到 `CameraSystem.active`。
 * 根 Module 可用 `useValue` 覆盖 `ThreeCoreModule` 的默认空配置。
 */
export type ViewportOptions = {
  /** 相机世界坐标 */
  position?: [number, number, number];
  /** lookAt 目标点 */
  lookAt?: [number, number, number];
  /** 透视相机 fov（度）；设置后会 `updateProjectionMatrix` */
  fov?: number;
};

/** 视口配置 Token；默认 `{}`（不改动 CameraSystem 初始值） */
export const THREE_VIEWPORT = createToken<ViewportOptions>('three.viewport');
