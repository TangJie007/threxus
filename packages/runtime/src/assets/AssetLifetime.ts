/**
 * 可绑定到 AssetManager 条目的资产生命周期钩子。
 * GLTF 实例通过 retain/release 保持父资产引用，即使业务 Handle 已释放。
 */

export interface AssetLifetimeHooks {
  retain(): void;
  release(): void;
}

export interface BindableAsset {
  bindLifetime(hooks: AssetLifetimeHooks): void;
}

export function isBindableAsset(value: unknown): value is BindableAsset {
  return (
    typeof value === 'object' &&
    value !== null &&
    'bindLifetime' in value &&
    typeof (value as BindableAsset).bindLifetime === 'function'
  );
}
