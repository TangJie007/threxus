import type { Token } from '../token';

// Wide ctor signature is required so decorated classes with deps remain assignable.
export type Constructor<T = unknown> = new (...args: any[]) => T;

export type InjectionToken<T = unknown> = Token<T> | Constructor<T>;

export interface InjectableOptions {
  /**
   * Constructor dependencies, resolved in order and passed to `new Class(...deps)`.
   * Prefer this over field `@Inject` for the primary injection path.
   */
  inject?: InjectionToken[];
}

export interface FieldInjection {
  name: string | symbol;
  token: InjectionToken;
}

export interface ClassMetadata {
  inject: InjectionToken[];
  fields: FieldInjection[];
}

export type Provider<T = unknown> =
  | Constructor<T>
  | { provide: InjectionToken<T>; useValue: T }
  | {
      provide: InjectionToken<T>;
      useClass: Constructor<T>;
    }
  | {
      provide: InjectionToken<T>;
      useFactory: (...args: any[]) => T;
      inject?: InjectionToken[];
    };

export function isConstructor(value: unknown): value is Constructor {
  return typeof value === 'function';
}
