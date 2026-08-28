/**
 * Three.js 相关约定 Token。
 */

import { createToken } from '@threxus/core';
import type {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

/** WebGLRenderer 单例（App 级） */
export const WEBGL_RENDERER = createToken<WebGLRenderer>('threxus.webglRenderer');

/** 主 Scene（默认可被场景模块覆盖） */
export const SCENE = createToken<Scene>('threxus.scene');

/** 主透视相机 */
export const CAMERA = createToken<PerspectiveCamera>('threxus.camera');
