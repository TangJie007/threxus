/**
 * 生命周期原语：可释放对象与清理回调的统一抽象。
 *
 * FeatureScope、CleanupStack、ThreeApp 都依赖这里的类型约定：
 * - `Disposable`：带 `dispose()` 的对象。
 * - `Cleanup`：函数或 Disposable，注册后由栈在销毁时执行。
 */

/** 具有显式释放方法的对象。 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/** 清理回调：同步/异步函数，或实现了 Disposable 的对象。 */
export type Cleanup = (() => void | Promise<void>) | Disposable;

/**
 * 判断值是否实现了 Disposable 接口。
 * 仅检查 `dispose` 是否为函数，不做 instanceof 判断，以兼容跨包对象。
 */
export function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof value.dispose === 'function'
  );
}
