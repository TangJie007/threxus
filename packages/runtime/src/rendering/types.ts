import type {
  Camera,
  ColorRepresentation,
  Fog,
  FogExp2,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  ShadowMapType,
  ToneMapping,
  WebGLRenderer,
} from 'three';

/** 核心 Three.js 对象所有权。 */
export type Ownership = 'app' | 'external';

export interface SceneOptions {
  readonly background?: ColorRepresentation;
  readonly fog?: Fog | FogExp2;
}

export interface RendererOptions {
  readonly antialias?: boolean;
  readonly alpha?: boolean;
  readonly powerPreference?: WebGLPowerPreference;
  readonly logarithmicDepthBuffer?: boolean;
  readonly preserveDrawingBuffer?: boolean;
  readonly shadows?: boolean | ShadowMapType;
  readonly outputColorSpace?: WebGLRenderer['outputColorSpace'];
  readonly toneMapping?: ToneMapping;
  readonly toneMappingExposure?: number;
}

export type Vector3Like =
  | { readonly x: number; readonly y: number; readonly z: number }
  | readonly [number, number, number];

export interface PerspectiveCameraOptions {
  readonly type: 'perspective';
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly position?: Vector3Like;
  readonly target?: Vector3Like;
}

export interface OrthographicCameraOptions {
  readonly type: 'orthographic';
  readonly near?: number;
  readonly far?: number;
  readonly zoom?: number;
  readonly frustumSize?: number;
  readonly position?: Vector3Like;
  readonly target?: Vector3Like;
}

export type CameraOptions =
  | PerspectiveCameraOptions
  | OrthographicCameraOptions;

export interface PixelRatioPolicy {
  readonly mode: 'device';
  readonly max: number;
}

export type PixelRatioOption = number | 'device' | PixelRatioPolicy;

export interface ResizeOptions {
  readonly enabled?: boolean;
}

export interface RenderSize {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

export interface RenderContext {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly renderer: WebGLRenderer;
}

export interface CameraChangedEvent {
  readonly previous: Camera;
  readonly current: Camera;
}

export interface ResolvedCoreObject<T> {
  readonly value: T;
  readonly ownership: Ownership;
}

export type SceneSource = Scene | SceneOptions | undefined;
export type CameraSource = Camera | CameraOptions | undefined;
export type RendererSource = WebGLRenderer | RendererOptions | undefined;

export interface RenderingInitOptions {
  readonly canvas: HTMLCanvasElement;
  readonly scene?: SceneSource;
  readonly camera?: CameraSource;
  readonly renderer?: RendererSource;
  readonly pixelRatio?: PixelRatioOption;
  readonly resize?: boolean | ResizeOptions;
}

export function isPerspectiveCamera(
  camera: Camera,
): camera is PerspectiveCamera {
  return (camera as PerspectiveCamera).isPerspectiveCamera === true;
}

export function isOrthographicCamera(
  camera: Camera,
): camera is OrthographicCamera {
  return (camera as OrthographicCamera).isOrthographicCamera === true;
}

export function isOrthographicCameraOptions(
  source: RenderingInitOptions['camera'],
): source is OrthographicCameraOptions {
  return (
    source !== undefined &&
    typeof source === 'object' &&
    'type' in source &&
    source.type === 'orthographic'
  );
}
