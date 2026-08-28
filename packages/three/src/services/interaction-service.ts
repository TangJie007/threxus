/**
 * 交互服务：指针拾取（Raycaster）。
 *
 * 过滤 / 改写结果走 Interaction 中间件；业务选中交给 SelectionService。
 */

import {
  Inject,
  Injectable,
  type OnDispose,
  type OnModuleInit,
} from '@threxus/core';
import { CANVAS } from '@threxus/runtime';
import {
  PerspectiveCamera,
  Raycaster,
  Vector2,
  type Intersection,
  type Object3D,
} from 'three';
import {
  createPipeline,
  type Middleware,
  type Pipeline,
} from '../middleware';
import { CameraService } from './camera-service';
import { SceneService } from './scene-service';
import { SelectionService } from './selection-service';

/** Interaction 流水线上下文 */
export type InteractionContext = {
  ndc: Vector2;
  event: PointerEvent;
  hits: Intersection[];
  /** 中间件可清空或过滤 */
  allowed: boolean;
};

@Injectable()
export class InteractionService implements OnModuleInit, OnDispose {
  @Inject(CANVAS)
  canvas: HTMLCanvasElement | null;

  @Inject(SceneService)
  scenes: SceneService;

  @Inject(CameraService)
  cameras: CameraService;

  @Inject(SelectionService)
  selection: SelectionService;

  private readonly raycaster = new Raycaster();
  private readonly middlewares: Middleware<InteractionContext>[] = [];
  private pipeline: Pipeline<InteractionContext> = createPipeline();
  private readonly onPointerDown = (event: PointerEvent): void => {
    void this.handlePointer(event);
  };

  /**
   * 注册 Interaction 中间件。
   */
  use(middleware: Middleware<InteractionContext>): this {
    this.middlewares.push(middleware);
    this.pipeline = createPipeline(this.middlewares);
    return this;
  }

  onModuleInit(): void {
    this.canvas?.addEventListener('pointerdown', this.onPointerDown);
  }

  onDispose(): void {
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
  }

  /**
   * 对当前场景做一次射线检测（不经中间件）。
   */
  pick(
    ndcX: number,
    ndcY: number,
    roots?: Object3D[],
  ): Intersection[] {
    const ndc = new Vector2(ndcX, ndcY);
    this.raycaster.setFromCamera(
      ndc,
      this.cameras.active as PerspectiveCamera,
    );
    const objects = roots ?? this.scenes.active.children;
    return this.raycaster.intersectObjects(objects, true);
  }

  private async handlePointer(event: PointerEvent): Promise<void> {
    if (!this.canvas) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const hits = this.pick(x, y);
    const ctx: InteractionContext = {
      ndc: new Vector2(x, y),
      event,
      hits,
      allowed: true,
    };
    await this.pipeline(ctx, (c) => {
      if (!c.allowed) {
        return;
      }
      const first = c.hits[0]?.object;
      if (first) {
        this.selection.set([first]);
      } else {
        this.selection.clear();
      }
    });
  }
}
