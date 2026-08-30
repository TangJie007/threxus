import type { Object3D } from 'three'

/** Match test project's PICKABLE_LAYER = 1 enable behavior (threxus pickId is set separately on nodes). */
export const PICKABLE_LAYER = 1

function layerBits(mask: number): string {
  const on: number[] = []
  for (let i = 0; i < 32; i++) {
    if (mask & (1 << i)) on.push(i)
  }
  return on.length ? on.join(',') : '(none)'
}

/**
 * 打开「拾取层」：让射线检测能打到这棵子树里的物体。
 *
 * Three.js 每个 Object3D 有 32 个 layer 位。默认只在第 0 层。
 * 本项目 input.layersMask = 1 << 1，射线只测第 1 层；
 * 所以要 enable(1)，物体同时在 0（相机能看见）和 1（能被点选）。
 */
export function markPickable(root: Object3D): void {
  const before = root.layers.mask
  root.traverse((o) => o.layers.enable(PICKABLE_LAYER))
  const after = root.layers.mask

  // 调试用：打开工厂页 DevTools Console 可见
  console.log('[markPickable] 给物体打开拾取层 layer=1', {
    name: root.name || root.type,
    pickId: root.userData.pickId,
    '打开前在哪些层': layerBits(before),
    '打开后在哪些层': layerBits(after),
    'mask 数值 before→after': `${before} → ${after}`,
    含义: '相机仍看第0层所以看得见；射线只测第1层所以能点选',
  })
}
