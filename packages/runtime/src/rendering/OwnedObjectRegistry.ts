import type { Object3D } from 'three';
import type { Disposable } from '../lifecycle/Disposable';
import type { FeatureScope } from '../feature/FeatureScope';

/** 追踪 Feature 拥有的场景节点；销毁时从父节点移除，不递归 dispose GPU 资源。 */
export class OwnedObjectRegistry {
  readonly #objects = new WeakMap<FeatureScope, Set<Object3D>>();

  own(scope: FeatureScope, object: Object3D): Disposable {
    let owned = this.#objects.get(scope);
    if (!owned) {
      owned = new Set();
      this.#objects.set(scope, owned);
    }
    owned.add(object);

    return {
      dispose: () => {
        object.removeFromParent();
        owned?.delete(object);
      },
    };
  }
}
