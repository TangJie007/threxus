import * as THREE from 'three'

export interface PickResult {
  object: THREE.Object3D
  /** InstancedMesh 命中的实例下标，非实例化物体为 undefined */
  instanceId?: number
  point: THREE.Vector3
  distance: number
}

export interface PickerEvents {
  hover?: (hit: PickResult | null) => void
  click?: (hit: PickResult | null) => void
}

/**
 * 射线拾取。工业场景的拾取有三个坑：
 *
 * 1. pointermove 每帧可能触发 100+ 次，直接在回调里 raycast 必卡。
 *    正解：只记录坐标，真正 raycast 放到渲染循环里，一帧最多一次。
 * 2. 场景里地面、围栏、灯光辅助体都不该被拾取。
 *    正解：用 Layers 分层（PICKABLE = 1），raycaster.layers 只开这一层。
 * 3. 设备模型是多层嵌套的 glTF，命中的是某个深层 Mesh。
 *    正解：沿 parent 链向上找带 userData.pickId 的"逻辑对象"。
 */
export const PICKABLE_LAYER = 1

export class Picker {
  readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private pointerInside = false
  private moved = false
  private hovered: PickResult | null = null
  private targets: THREE.Object3D[] = []

  /** 是否开启拾取（拖拽旋转相机时应临时关闭） */
  enabled = true

  constructor(
    private readonly dom: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly events: PickerEvents = {},
  ) {
    this.raycaster.layers.set(PICKABLE_LAYER)
    this.raycaster.params.Line = { threshold: 0.2 }

    // 阈值区分「点击」和「拖拽旋转」，避免转完相机松手误触发点击
    this.dom.addEventListener('pointermove', this._onMove)
    this.dom.addEventListener('pointerdown', this._onDown)
    this.dom.addEventListener('pointerup', this._onUp)
    this.dom.addEventListener('pointerleave', this._onLeave)
  }

  /** 设置可拾取根节点（只传根，内部自动 traverse） */
  setTargets(roots: THREE.Object3D[]): void {
    this.targets = roots
  }

  private _onMove = (e: PointerEvent): void => {
    const r = this.dom.getBoundingClientRect()
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
    this.pointerInside = true
    this.moved = true
  }

  private _onLeave = (): void => {
    this.pointerInside = false
    this.moved = true
    if (this.hovered) {
      this.hovered = null
      this.events.hover?.(null)
    }
  }

  private downPos = { x: 0, y: 0 }
  private _onDown = (e: PointerEvent): void => {
    this.downPos.x = e.clientX
    this.downPos.y = e.clientY
  }

  private _onUp = (e: PointerEvent): void => {
    const dx = e.clientX - this.downPos.x
    const dy = e.clientY - this.downPos.y
    if (Math.hypot(dx, dy) > 5) return // 判定为拖拽，不触发 click
    if (e.button !== 0) return
    this.events.click?.(this.hovered)
  }

  /** 在渲染循环里调用，一帧一次 */
  update(): void {
    if (!this.enabled) return
    if (!this.moved) return
    this.moved = false

    if (!this.pointerInside) return

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.targets, true)
    const hit = this.resolve(hits)

    const sameHit =
      hit &&
      this.hovered &&
      hit.object === this.hovered.object &&
      hit.instanceId === this.hovered.instanceId

    if (!sameHit) {
      this.hovered = hit
      this.events.hover?.(hit)
    }
  }

  /**
   * 从原始命中结果里解析出"逻辑对象"。两条路径：
   *
   *  A. InstancedMesh：物体被实例化后，成百上千个实例共用一个 Object3D，
   *     parent 链上不可能有 pickId。必须靠 instanceId 去
   *     userData.instancePickIds（下标与实例一一对应）反查归属设备。
   *     —— 这是"实例化之后还能不能点选"的通用解法。
   *  B. 普通物体：沿 parent 链上溯，找第一个标记了 userData.pickId 的节点。
   */
  private resolve(hits: THREE.Intersection[]): PickResult | null {
    for (const h of hits) {
      let logical: THREE.Object3D | null = null

      const pickIds = h.object.userData?.instancePickIds as string[] | undefined
      if (pickIds && h.instanceId !== undefined && pickIds[h.instanceId]) {
        logical = findByPickId(this.targets, pickIds[h.instanceId])
      }
      if (!logical) logical = findLogicalParent(h.object)

      if (!logical) continue
      if (!logical.visible) continue
      return {
        object: logical,
        instanceId: h.instanceId,
        point: h.point.clone(),
        distance: h.distance,
      }
    }
    return null
  }

  get current(): PickResult | null {
    return this.hovered
  }

  dispose(): void {
    this.dom.removeEventListener('pointermove', this._onMove)
    this.dom.removeEventListener('pointerdown', this._onDown)
    this.dom.removeEventListener('pointerup', this._onUp)
    this.dom.removeEventListener('pointerleave', this._onLeave)
  }
}

function findLogicalParent(obj: THREE.Object3D): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur.userData && cur.userData.pickId) return cur
    cur = cur.parent
  }
  return null
}

/** 按 pickId 在若干根节点下查找对象（实例化反查用） */
function findByPickId(roots: THREE.Object3D[], id: string): THREE.Object3D | null {
  for (const root of roots) {
    let found: THREE.Object3D | null = null
    root.traverse((o) => {
      if (!found && o.userData?.pickId === id) found = o
    })
    if (found) return found
  }
  return null
}

/**
 * 把一棵子树加入可拾取层。
 *
 * 注意必须用 enable 而不是 set！
 * layers 是位掩码，set(1) 会把默认的第 0 层关掉，
 * 而相机默认只看第 0 层 —— 结果就是物体能拾取但渲染不出来，全场"隐形"。
 * 正确做法是保留第 0 层（渲染可见），额外开启第 1 层（拾取标记）。
 */
export function markPickable(root: THREE.Object3D): void {
  root.traverse((o) => o.layers.enable(PICKABLE_LAYER))
}
