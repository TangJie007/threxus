export interface Disposable {
  dispose(): void | Promise<void>;
}

export type Cleanup = (() => void | Promise<void>) | Disposable;

export function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof value.dispose === 'function'
  );
}
