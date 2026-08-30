import type {
  Camera,
  Object3D,
  Scene,
  WebGLRenderer,
} from 'three';
import type { AssetHandle, AssetManager } from '../assets';
import type { Cleanup, Disposable } from '../lifecycle/Disposable';
import type { FrameInfo } from '../scheduler/FrameInfo';
import type {
  TaskOptions,
  UpdateCallback,
} from '../scheduler/SchedulerTask';

export type EntityState =
  | 'creating'
  | 'active'
  | 'disposing'
  | 'disposed'
  | 'failed';

/** 实体创建期间可用的实体级生命周期上下文。 */
export interface EntityContext {
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly camera: Camera;
  readonly renderer: WebGLRenderer;
  readonly assets: AssetManager;
  readonly signal: AbortSignal;

  addCleanup(cleanup: Cleanup): Disposable;
  retain<T>(handle: AssetHandle<T>): void;
  own(object: Object3D): void;
  onUpdate(callback: UpdateCallback, options?: TaskOptions): Disposable;
  invalidate(): void;
}

export interface EntityCreateResultBase {
  readonly root: Object3D;
  readonly update?: (frame: FrameInfo) => void;
  readonly dispose?: () => void | Promise<void>;
}

export type EntityCreateResult<TApi = void> = EntityCreateResultBase &
  ([TApi] extends [void]
    ? { readonly api?: undefined }
    : { readonly api: TApi });

export interface EntityDefinition<TProps = void, TApi = void> {
  readonly id: symbol;
  readonly type: string;
  create(
    context: EntityContext,
    props: TProps,
  ): EntityCreateResult<TApi> | Promise<EntityCreateResult<TApi>>;
}

export interface DefineEntityOptions<TProps = void, TApi = void> {
  readonly type: string;
  create(
    context: EntityContext,
    props: TProps,
  ): EntityCreateResult<TApi> | Promise<EntityCreateResult<TApi>>;
}

export interface SpawnEntityOptions {
  /** App 内唯一实体 id；未提供时按实体类型自动生成。 */
  readonly id?: string;
  /** 实体根节点的父节点，默认使用 App scene。 */
  readonly parent?: Object3D;
}

interface EntityHandleBase extends Disposable {
  readonly id: string;
  readonly type: string;
  readonly root: Object3D;
  readonly state: EntityState;
}

export type EntityHandle<TApi = void> = EntityHandleBase &
  ([TApi] extends [void]
    ? { readonly api: undefined }
    : { readonly api: TApi });

/** 定义可由 Feature 重复 spawn 的实体蓝图。 */
export function defineEntity<TProps = void, TApi = void>(
  options: DefineEntityOptions<TProps, TApi>,
): EntityDefinition<TProps, TApi> {
  if (!options.type.trim()) {
    throw new TypeError('Entity type must be a non-empty string.');
  }

  return Object.freeze({
    id: Symbol(options.type),
    type: options.type,
    create: options.create,
  });
}
