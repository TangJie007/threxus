/**
 * 装饰器元数据的读写层。
 *
 * 基于 TC39 Stage 3 Decorator Metadata（`Symbol.metadata`），
 * 不引入 `reflect-metadata` 或其他第三方库。
 *
 * 约定：所有 Threxus DI 元数据集中挂在 `THREXUS_METADATA` 键下，
 * 避免与其它库的 metadata 字段冲突。
 */
import type { ModuleMetadata } from '../module/types';
import type { ClassMetadata, Constructor, FieldInjection, InjectionToken, Provider } from '../types';
/**
 * 写入 `context.metadata` / `Class[Symbol.metadata]` 时使用的命名空间键。
 */
export declare const THREXUS_METADATA: unique symbol;
/**
 * 存储在 metadata 袋中的原始结构（可被多次装饰器增量写入）。
 */
export interface ThrexusMetadata {
    /** 构造函数依赖令牌 */
    inject?: InjectionToken[];
    /** 字段注入列表 */
    fields?: FieldInjection[];
    /** `@Module` 声明（仅模块类存在） */
    module?: {
        imports: Constructor[];
        providers: Provider[];
        exports?: InjectionToken[];
    };
}
/**
 * 写入 `@Injectable` 声明的构造函数依赖。
 *
 * @param context - 类装饰器上下文
 * @param inject - 构造依赖令牌列表（可为空数组）
 */
export declare function writeInjectableMetadata(context: ClassDecoratorContext, inject: InjectionToken[]): void;
/**
 * 追加一条字段 `@Inject` 记录。
 *
 * @param context - 字段装饰器上下文
 * @param token - 该字段对应的注入令牌
 */
export declare function writeFieldInjectMetadata(context: ClassFieldDecoratorContext, token: InjectionToken): void;
/**
 * 写入 `@Module` 配置。
 *
 * @param context - 类装饰器上下文
 * @param options - 模块配置（已由装饰器侧规范化）
 */
export declare function writeModuleMetadata(context: ClassDecoratorContext, options: {
    imports: Constructor[];
    providers: Provider[];
    exports?: InjectionToken[];
}): void;
/**
 * 读取类上的完整注入元数据；若无装饰则返回空列表。
 *
 * 返回值为浅拷贝，避免调用方修改内部缓存结构。
 *
 * @param target - 类构造函数
 */
export declare function readClassMetadata(target: object): ClassMetadata;
/**
 * 读取 `@Module` 元数据。
 *
 * @param target - 模块类
 * @returns 规范化后的模块元数据；若未装饰 `@Module` 则返回 `undefined`
 */
export declare function readModuleMetadata(target: object): ModuleMetadata | undefined;
/**
 * 判断类是否声明了 `@Module`。
 *
 * @param target - 任意类
 */
export declare function isModule(target: object): boolean;
