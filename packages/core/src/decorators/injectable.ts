import { writeInjectableMetadata } from '../metadata';
import type { InjectableOptions } from '../types';

/**
 * Marks a class as injectable and declares constructor tokens (scheme B).
 * Field `@Inject` metadata (scheme A) is merged at resolve time.
 */
export function Injectable(options: InjectableOptions = {}) {
  return <Class extends abstract new (...args: any[]) => unknown>(
    _value: Class,
    context: ClassDecoratorContext<Class>,
  ): void => {
    if (context.kind !== 'class') {
      throw new Error('@Injectable() can only decorate classes.');
    }

    writeInjectableMetadata(context, options.inject ?? []);
  };
}
