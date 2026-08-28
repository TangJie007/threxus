/**
 * DI 相关的共享类型与类型守卫。
 *
 * 本模块不包含运行时容器逻辑，仅描述「如何声明依赖与 Provider」。
 */
import type { Token } from '../token';
/**
 * 可被容器实例化的构造函数类型。
 *
 * 使用宽松的参数签名，确保带构造依赖的业务类仍可赋值给该类型。
 *
 * @typeParam T - 实例类型
 */
export type Constructor<T = unknown> = new (...args: any[]) => T;
/**
 * 可用于查找 Provider 的注入标识。
 *
 * - `Token<T>`：推荐的显式令牌
 * - `Constructor<T>`：以类本身作为令牌（类简写注册时常用）
 *
 * @typeParam T - 解析结果类型
 */
export type InjectionToken<T = unknown> = Token<T> | Constructor<T>;
/**
 * `@Injectable` 的配置项。
 */
export interface InjectableOptions {
    /**
     * 构造函数依赖列表，按顺序解析后传入 `new Class(...deps)`。
     *
     * 这是方案 C 中的主路径（显式 `inject`）；字段 `@Inject` 为辅路径。
     */
    inject?: InjectionToken[];
}
/**
 * 单个字段注入的元数据描述。
 */
export interface FieldInjection {
    /** 字段名（字符串或 symbol） */
    name: string | symbol;
    /** 该字段应解析的令牌 */
    token: InjectionToken;
}
/**
 * 从类上读出的完整注入元数据（构造依赖 + 字段依赖）。
 */
export interface ClassMetadata {
    /** 构造函数参数对应的令牌列表 */
    inject: InjectionToken[];
    /** 需要在构造完成后赋值的字段列表 */
    fields: FieldInjection[];
}
/**
 * 向容器注册依赖的 Provider 联合类型。
 *
 * @typeParam T - Provider 最终提供的值类型
 *
 * 支持四种形态：
 * 1. 类简写：直接传构造函数，令牌即该类本身
 * 2. `useValue`：直接绑定已有实例/常量
 * 3. `useClass`：令牌映射到另一个类
 * 4. `useFactory`：工厂函数创建，可声明 `inject`
 */
export type Provider<T = unknown> = Constructor<T> | {
    provide: InjectionToken<T>;
    useValue: T;
} | {
    provide: InjectionToken<T>;
    useClass: Constructor<T>;
} | {
    provide: InjectionToken<T>;
    useFactory: (...args: any[]) => T;
    /** 工厂参数对应的令牌，缺省表示无依赖 */
    inject?: InjectionToken[];
};
/**
 * 判断值是否可作为构造函数 Provider（类简写）。
 *
 * 使用 `typeof` 以便 TypeScript 正确收窄 `Provider` 联合类型；
 * 通用函数判断见 `es-toolkit` 的 `isFunction`（生命周期等处使用）。
 *
 * @param value - 待检测值
 * @returns 若为函数则视为构造函数
 */
export declare function isConstructor(value: unknown): value is Constructor;
