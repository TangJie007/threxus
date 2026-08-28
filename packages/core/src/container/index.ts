import { readClassMetadata } from '../metadata';
import type { Token } from '../token';
import {
  isConstructor,
  type Constructor,
  type InjectionToken,
  type Provider,
} from '../types';

type NormalizedProvider = {
  token: InjectionToken;
  resolve: (container: Container) => unknown;
};

function describeToken(token: InjectionToken): string {
  if (typeof token === 'symbol') {
    return token.description ?? String(token);
  }

  return token.name || '(anonymous class)';
}

export class Container {
  private readonly providers = new Map<InjectionToken, NormalizedProvider>();
  private readonly instances = new Map<InjectionToken, unknown>();
  private readonly resolving = new Set<InjectionToken>();

  /** Register one or more providers (class shorthand or explicit). */
  register(...providers: Provider[]): this {
    for (const provider of providers) {
      this.registerOne(provider);
    }
    return this;
  }

  /** Eagerly bind a concrete value (same as `{ provide, useValue }`). */
  set<T>(token: Token<T> | Constructor<T>, value: T): this {
    return this.register({ provide: token, useValue: value });
  }

  has(token: InjectionToken): boolean {
    return this.providers.has(token) || this.instances.has(token);
  }

  get<T>(token: InjectionToken<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const provider = this.providers.get(token);
    if (!provider) {
      throw new Error(`No provider for token "${describeToken(token)}".`);
    }

    if (this.resolving.has(token)) {
      const chain = [...this.resolving, token].map(describeToken).join(' -> ');
      throw new Error(`Circular dependency detected: ${chain}`);
    }

    this.resolving.add(token);
    try {
      const instance = provider.resolve(this);
      this.instances.set(token, instance);
      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  /** Create (or return cached) instance for a registered class token. */
  resolve<T>(Class: Constructor<T>): T {
    if (!this.providers.has(Class)) {
      this.register(Class);
    }
    return this.get(Class);
  }

  private registerOne(provider: Provider): void {
    if (isConstructor(provider)) {
      this.put({
        token: provider,
        resolve: (container) => container.instantiate(provider),
      });
      return;
    }

    if ('useValue' in provider) {
      this.put({
        token: provider.provide,
        resolve: () => provider.useValue,
      });
      this.instances.set(provider.provide, provider.useValue);
      return;
    }

    if ('useClass' in provider) {
      const Class = provider.useClass;
      this.put({
        token: provider.provide,
        resolve: (container) => container.instantiate(Class),
      });
      return;
    }

    if ('useFactory' in provider) {
      const inject = provider.inject ?? [];
      const factory = provider.useFactory;
      this.put({
        token: provider.provide,
        resolve: (container) => {
          const deps = inject.map((dep) => container.get(dep));
          return factory(...deps);
        },
      });
    }
  }

  private put(provider: NormalizedProvider): void {
    if (
      this.providers.has(provider.token) ||
      this.instances.has(provider.token)
    ) {
      this.instances.delete(provider.token);
    }
    this.providers.set(provider.token, provider);
  }

  private instantiate<T>(Class: Constructor<T>): T {
    const meta = readClassMetadata(Class);
    const ctorDeps = meta.inject.map((token) => this.get(token));
    const instance = new Class(...ctorDeps);

    for (const field of meta.fields) {
      Object.defineProperty(instance, field.name, {
        value: this.get(field.token),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    return instance;
  }
}

export function createContainer(): Container {
  return new Container();
}
