/**
 * `@Module`：声明模块的 imports / providers / exports。
 */

import { writeModuleMetadata } from '../metadata';
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
export function Module(options: ModuleOptions = {}) {
  return <Class extends abstract new (...args: any[]) => unknown>(
    _value: Class,
    context: ClassDecoratorContext<Class>,
  ): void => {
    if (context.kind !== 'class') {
      throw new Error('@Module() 只能用于装饰类。');
    }

    writeModuleMetadata(context, {
      imports: options.imports ?? [],
      providers: options.providers ?? [],
      exports: options.exports,
    });
  };
}
