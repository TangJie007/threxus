export interface ServiceKey<T> {
  readonly id: symbol;
  readonly description: string;
  readonly __type?: T;
}

export function createServiceKey<T>(description: string): ServiceKey<T> {
  if (description.trim().length === 0) {
    throw new TypeError('Service key description cannot be empty.');
  }

  return Object.freeze({
    id: Symbol(description),
    description,
  });
}
