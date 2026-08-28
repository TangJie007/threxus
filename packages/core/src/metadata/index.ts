/**
 * 装饰器元数据的读写层。
 *
 * 基于 TC39 Stage 3 Decorator Metadata（`Symbol.metadata`），
 * 不引入 `reflect-metadata` 或其他第三方库。
 *
 * 约定：所有 Threxus DI 元数据集中挂在 `THREXUS_METADATA` 键下，
 * 避免与其它库的 metadata 字段冲突。
 */

import type { ClassMetadata, FieldInjection, InjectionToken } from '../types';

/**
 * 写入 `context.metadata` / `Class[Symbol.metadata]` 时使用的命名空间键。
 */
export const THREXUS_METADATA = Symbol.for('threxus.di');

/**
 * 存储在 metadata 袋中的原始结构（可被多次装饰器增量写入）。
 */
export interface ThrexusMetadata {
  /** 构造函数依赖令牌 */
  inject?: InjectionToken[];
  /** 字段注入列表 */
  fields?: FieldInjection[];
}

/** metadata 袋的宽松字典类型 */
type MetadataBag = Record<string | symbol, unknown>;

/**
 * 确保运行时存在 `Symbol.metadata`。
 *
 * 部分环境尚未实现该 well-known symbol；此处用极小内联 shim 补齐，
 * 不依赖任何 polyfill 包。
 */
const METADATA_SYMBOL: symbol = (() => {
  const runtime = Symbol as typeof Symbol & { metadata?: symbol };
  if (!runtime.metadata) {
    Object.defineProperty(runtime, 'metadata', {
      value: Symbol.for('Symbol.metadata'),
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
  return runtime.metadata!;
})();

/**
 * 从目标类上读取 Threxus 元数据袋（若尚未装饰则返回 `undefined`）。
 *
 * @param target - 通常为类构造函数
 */
function getMetadataRecord(target: object): ThrexusMetadata | undefined {
  const bag = (target as Record<symbol, MetadataBag | undefined>)[
    METADATA_SYMBOL
  ];
  if (!bag) {
    return undefined;
  }

  return bag[THREXUS_METADATA] as ThrexusMetadata | undefined;
}

/**
 * 在装饰器 `context.metadata` 上确保存在 Threxus 元数据对象并返回之。
 *
 * 类装饰器与字段装饰器共享同一 metadata 对象，因此可安全合并写入。
 *
 * @param context - Stage 3 装饰器上下文（需带 `metadata`）
 */
function ensureMetadataRecord(context: {
  metadata?: DecoratorMetadata | null;
}): ThrexusMetadata {
  const bag = (context.metadata ??= {}) as MetadataBag;
  const existing = bag[THREXUS_METADATA] as ThrexusMetadata | undefined;
  if (existing) {
    return existing;
  }

  const created: ThrexusMetadata = {};
  bag[THREXUS_METADATA] = created;
  return created;
}

/**
 * 写入 `@Injectable` 声明的构造函数依赖。
 *
 * @param context - 类装饰器上下文
 * @param inject - 构造依赖令牌列表（可为空数组）
 */
export function writeInjectableMetadata(
  context: ClassDecoratorContext,
  inject: InjectionToken[],
): void {
  const meta = ensureMetadataRecord(context);
  meta.inject = inject;
}

/**
 * 追加一条字段 `@Inject` 记录。
 *
 * @param context - 字段装饰器上下文
 * @param token - 该字段对应的注入令牌
 */
export function writeFieldInjectMetadata(
  context: ClassFieldDecoratorContext,
  token: InjectionToken,
): void {
  const meta = ensureMetadataRecord(context);
  meta.fields ??= [];
  meta.fields.push({ name: context.name, token });
}

/**
 * 读取类上的完整注入元数据；若无装饰则返回空列表。
 *
 * 返回值为浅拷贝，避免调用方修改内部缓存结构。
 *
 * @param target - 类构造函数
 */
export function readClassMetadata(target: object): ClassMetadata {
  const meta = getMetadataRecord(target);
  return {
    inject: meta?.inject ? [...meta.inject] : [],
    fields: meta?.fields ? [...meta.fields] : [],
  };
}
