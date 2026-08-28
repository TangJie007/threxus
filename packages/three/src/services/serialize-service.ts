/**
 * 序列化 / 反序列化服务：场景 JSON 进出 + zod 校验。
 */

import { Inject, Injectable } from '@threxus/core';
import { Object3D, Vector3 } from 'three';
import { z } from 'zod';
import {
  createPipeline,
  type Middleware,
  type Pipeline,
} from '../middleware';
import { SceneService } from './scene-service';

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

/** 场景节点 schema */
export const sceneNodeSchema = z.object({
  name: z.string().optional(),
  position: vec3Schema,
  rotation: vec3Schema,
  scale: vec3Schema,
  /** 用户自定义标记，便于反序列化工厂识别 */
  type: z.string().optional(),
  userData: z.record(z.string(), z.unknown()).optional(),
});

export const sceneDocumentSchema = z.object({
  version: z.literal(1),
  nodes: z.array(sceneNodeSchema),
});

export type SceneNodeData = z.infer<typeof sceneNodeSchema>;
export type SceneDocument = z.infer<typeof sceneDocumentSchema>;

export type SerializeContext = {
  document: SceneDocument;
};

export type DeserializeContext = {
  raw: unknown;
  document?: SceneDocument;
  /** 校验失败时由中间件短路 */
  valid: boolean;
};

@Injectable()
export class SerializeService {
  @Inject(SceneService)
  scenes: SceneService;

  private readonly serializeMw: Middleware<SerializeContext>[] = [];
  private readonly deserializeMw: Middleware<DeserializeContext>[] = [];
  private serializePipeline: Pipeline<SerializeContext> = createPipeline();
  private deserializePipeline: Pipeline<DeserializeContext> =
    createPipeline();

  useSerialize(middleware: Middleware<SerializeContext>): this {
    this.serializeMw.push(middleware);
    this.serializePipeline = createPipeline(this.serializeMw);
    return this;
  }

  useDeserialize(middleware: Middleware<DeserializeContext>): this {
    this.deserializeMw.push(middleware);
    this.deserializePipeline = createPipeline(this.deserializeMw);
    return this;
  }

  /**
   * 导出当前 active 场景直系子节点变换。
   */
  async serialize(roots?: Object3D[]): Promise<SceneDocument> {
    const objects = roots ?? this.scenes.active.children;
    const nodes: SceneNodeData[] = objects.map((obj) => this.nodeFrom(obj));
    const document: SceneDocument = { version: 1, nodes };
    const ctx: SerializeContext = { document };
    await this.serializePipeline(ctx);
    return ctx.document;
  }

  /**
   * 校验并返回文档；不自动重建 Mesh（由业务工厂消费 nodes）。
   */
  async deserialize(raw: unknown): Promise<SceneDocument> {
    const ctx: DeserializeContext = { raw, valid: true };
    await this.deserializePipeline(ctx, (c) => {
      const parsed = sceneDocumentSchema.safeParse(c.raw);
      if (!parsed.success) {
        c.valid = false;
        throw new Error(`场景 JSON 校验失败：${parsed.error.message}`);
      }
      c.document = parsed.data;
    });
    if (!ctx.document || !ctx.valid) {
      throw new Error('场景反序列化失败。');
    }
    return ctx.document;
  }

  private nodeFrom(object: Object3D): SceneNodeData {
    const toTuple = (v: Vector3): [number, number, number] => [
      v.x,
      v.y,
      v.z,
    ];
    return {
      name: object.name || undefined,
      position: toTuple(object.position),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: toTuple(object.scale),
      type:
        typeof object.userData.threxusType === 'string'
          ? object.userData.threxusType
          : undefined,
      userData: { ...object.userData },
    };
  }
}
