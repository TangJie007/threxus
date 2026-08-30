import type { Object3D } from 'three'

/** Match test project's PICKABLE_LAYER = 1 enable behavior (threxus pickId is set separately on nodes). */
export const PICKABLE_LAYER = 1

export function markPickable(root: Object3D): void {
  root.traverse((o) => o.layers.enable(PICKABLE_LAYER))
}
