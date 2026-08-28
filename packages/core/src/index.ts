export type Token<T> = symbol & { readonly __type?: T };

export function createToken<T>(description: string): Token<T> {
  return Symbol(description) as Token<T>;
}

export class Container {
  private readonly values = new Map<symbol, unknown>();

  set<T>(token: Token<T>, value: T): this {
    this.values.set(token, value);
    return this;
  }

  get<T>(token: Token<T>): T {
    if (!this.values.has(token)) {
      throw new Error('No value has been registered for this token.');
    }

    return this.values.get(token) as T;
  }

  has<T>(token: Token<T>): boolean {
    return this.values.has(token);
  }
}

export function createContainer(): Container {
  return new Container();
}
