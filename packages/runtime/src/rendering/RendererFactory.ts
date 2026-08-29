import { Scene, WebGLRenderer } from 'three';
import type {
  Ownership,
  RendererOptions,
  RendererSource,
  ResolvedCoreObject,
  SceneOptions,
  SceneSource,
} from './types';

export function resolveScene(source: SceneSource): ResolvedCoreObject<Scene> {
  if (source instanceof Scene) {
    return { value: source, ownership: 'external' };
  }

  const scene = new Scene();
  const options = source ?? {};

  if (options.background !== undefined) {
    scene.background = options.background as Scene['background'];
  }
  if (options.fog !== undefined) {
    scene.fog = options.fog;
  }

  return { value: scene, ownership: 'app' };
}

export function resolveRenderer(
  canvas: HTMLCanvasElement,
  source: RendererSource,
): ResolvedCoreObject<WebGLRenderer> {
  if (source instanceof WebGLRenderer) {
    return { value: source, ownership: 'external' };
  }

  const options = source ?? {};
  const renderer = new WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha,
    powerPreference: options.powerPreference,
    logarithmicDepthBuffer: options.logarithmicDepthBuffer,
    preserveDrawingBuffer: options.preserveDrawingBuffer,
  });

  if (options.outputColorSpace !== undefined) {
    renderer.outputColorSpace = options.outputColorSpace;
  }
  if (options.toneMapping !== undefined) {
    renderer.toneMapping = options.toneMapping;
  }
  if (options.toneMappingExposure !== undefined) {
    renderer.toneMappingExposure = options.toneMappingExposure;
  }

  if (options.shadows === true) {
    renderer.shadowMap.enabled = true;
  } else if (options.shadows !== undefined && options.shadows !== false) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = options.shadows;
  }

  return { value: renderer, ownership: 'app' };
}

export type { RendererOptions, SceneOptions };
