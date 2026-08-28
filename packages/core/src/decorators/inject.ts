import { writeFieldInjectMetadata } from '../metadata';
import type { InjectionToken } from '../types';

/**
 * Declares a field injection token (scheme A). Applied after construction.
 */
export function Inject(token: InjectionToken) {
  return (_value: undefined, context: ClassFieldDecoratorContext): void => {
    if (context.kind !== 'field') {
      throw new Error('@Inject() can only decorate class fields.');
    }

    writeFieldInjectMetadata(context, token);
  };
}
