/**
 * 装饰器元数据的读写层。
 *
 * 基于 TC39 Stage 3 Decorator Metadata（`Symbol.metadata`），
 * 不引入 `reflect-metadata` 或其他第三方库。
 *
 * 约定：各装饰器域使用 `META.*` 独立键挂到 `Class[Symbol.metadata]`，
 * 避免与其它库或未来扩展域互相踩字段。
 */

import type { ModuleMetadata } from '../module/types';
import type {
  ClassMetadata,
  Constructor,
  FieldInjection,
  InjectionToken,
  Provider,
} from '../types';

/**
 * Threxus 元数据键注册表（仅含当前真实使用的域）。
 *
 * 读写请走本模块的 `write*` / `read*`，业务侧一般不直接碰 `Symbol.metadata`。
 */
export const META = {
  /** `@Injectable` — `{ inject }` */
  INJECTABLE: Symbol.for('threxus:injectable'),
  /** `@Inject` 字段注入点列表 */
  INJECTIONS: Symbol.for('threxus:injections'),
  /** `@Module` — ModuleMetadata */
  MODULE: Symbol.for('threxus:module'),
} as const;

/** `@Injectable` 写入的结构 */
export interface InjectableMetadata {
  /** 构造函数依赖令牌（可为空数组） */
  inject: InjectionToken[];
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
 * 读取类上的 Stage 3 metadata 袋（若无则 `undefined`）。
 *
 * @param target - 通常为类构造函数
 */
function getBag(target: object): MetadataBag | undefined {
  return (target as Record<symbol, MetadataBag | undefined>)[METADATA_SYMBOL];
}

/**
 * 在装饰器 `context.metadata` 上确保存在袋对象。
 *
 * 类装饰器与字段装饰器共享同一 metadata 对象，因此可安全按键合并写入。
 *
 * @param context - Stage 3 装饰器上下文（需带 `metadata`）
 */
function ensureBag(context: {
  metadata?: DecoratorMetadata | null;
}): MetadataBag {
  return (context.metadata ??= {}) as MetadataBag;
}

/**
 * 从目标类读取某一 `META` 键。
 *
 * @typeParam T - 该键对应的元数据类型
 * @param target - 类构造函数
 * @param key - `META.*`
 */
function readKey<T>(target: object, key: symbol): T | undefined {
  const bag = getBag(target);
  if (!bag) {
    return undefined;
  }
  return bag[key] as T | undefined;
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
  const bag = ensureBag(context);
  const meta: InjectableMetadata = { inject: [...inject] };
  bag[META.INJECTABLE] = meta;
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
  const bag = ensureBag(context);
  const list = (bag[META.INJECTIONS] as FieldInjection[] | undefined) ?? [];
  list.push({ name: context.name, token });
  bag[META.INJECTIONS] = list;
}

/**
 * 写入 `@Module` 配置。
 *
 * @param context - 类装饰器上下文
 * @param options - 模块配置（已由装饰器侧规范化）
 */
export function writeModuleMetadata(
  context: ClassDecoratorContext,
  options: {
    imports: Constructor[];
    providers: Provider[];
    exports?: InjectionToken[];
  },
): void {
  const bag = ensureBag(context);
  const meta: ModuleMetadata = {
    imports: [...options.imports],
    providers: [...options.providers],
    exports: options.exports ? [...options.exports] : undefined,
  };
  bag[META.MODULE] = meta;
}

/**
 * 读取类上的完整注入元数据；若无装饰则返回空列表。
 *
 * 返回值为浅拷贝，避免调用方修改内部缓存结构。
 *
 * @param target - 类构造函数
 */
export function readClassMetadata(target: object): ClassMetadata {
  const injectable = readKey<InjectableMetadata>(target, META.INJECTABLE);
  const fields = readKey<FieldInjection[]>(target, META.INJECTIONS);
  return {
    inject: injectable?.inject ? [...injectable.inject] : [],
    fields: fields ? fields.map((field) => ({ ...field })) : [],
  };
}

/**
 * 读取 `@Module` 元数据。
 *
 * @param target - 模块类
 * @returns 规范化后的模块元数据；若未装饰 `@Module` 则返回 `undefined`
 */
export function readModuleMetadata(
  target: object,
): ModuleMetadata | undefined {
  const raw = readKey<ModuleMetadata>(target, META.MODULE);
  if (!raw) {
    return undefined;
  }

  return {
    imports: [...raw.imports],
    providers: [...raw.providers],
    exports: raw.exports ? [...raw.exports] : undefined,
  };
}

/**
 * 判断类是否声明了 `@Module`。
 *
 * @param target - 任意类
 */
export function isModule(target: object): boolean {
  return readKey<ModuleMetadata>(target, META.MODULE) !== undefined;
}
