/**
 * `@Module`：声明模块的 imports / providers / exports。
 */
import type { ModuleOptions } from './types';
/**
 * 类装饰器：将模块配置写入 Decorator Metadata。
 *
 * @param options - 模块配置；字段均可省略
 * @returns Stage 3 类装饰器
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [CoreModule],
 *   providers: [Greeter],
 *   // 不写 exports ⇒ 本模块全部 providers 对外可见
 * })
 * class AppModule {}
 * ```
 */
export declare function Module(options?: ModuleOptions): <Class extends abstract new (...args: any[]) => unknown>(_value: Class, context: ClassDecoratorContext<Class>) => void;
