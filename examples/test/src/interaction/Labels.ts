import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { DeviceRecord, DeviceStatus } from '@/data/devices'
import { statusText } from '@/data/devices'

/**
 * CSS2D 标签管理。
 *
 * 为什么工业孪生都用 CSS2D 而不是 Sprite？
 *  - 文字用 DOM 渲染，永远清晰，不需要为不同分辨率做多套贴图
 *  - 可以直接用 CSS 做样式、hover 效果、点击事件
 *  - 不占显存，几千个标签也不掉帧
 *
 * 三个必须处理的坑：
 *  1. 遮挡剔除 —— 设备被挡住时标签要淡出，否则满屏标签糊成一片
 *  2. 距离剔除 —— 太远的标签隐藏，避免视觉噪声
 *  3. 层级管理 —— 标签容器必须 pointer-events:none，否则挡住 3D 拾取
 */
export class Labels {
  private readonly items: Array<{
    device: DeviceRecord
    obj: CSS2DObject
    el: HTMLDivElement
    anchor: THREE.Vector3
  }> = []

  private readonly raycaster = new THREE.Raycaster()
  private readonly camDir = new THREE.Vector3()
  private readonly toLabel = new THREE.Vector3()

  visible = true
  /** 超过这个距离的标签隐藏 */
  maxDistance = 75
  /** 标签上方的偏移（世界单位） */
  offsetY = 3.4

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly occluders: THREE.Object3D[],
  ) {}

  add(device: DeviceRecord): void {
    const el = document.createElement('div')
    el.className = 'tag'
    el.innerHTML = `<i class="led"></i><span class="txt"></span>`
    el.style.pointerEvents = 'auto'

    const obj = new CSS2DObject(el)
    // 挂在设备节点下，位置自动跟随；但要注意设备节点若有缩放，标签也会跟着缩放
    obj.position.set(0, this.offsetY, 0)
    obj.center.set(0.5, 1)
    device.node.add(obj)

    const anchor = new THREE.Vector3()
    device.node.getWorldPosition(anchor)
    anchor.y += this.offsetY

    const item = { device, obj, el, anchor }
    this.items.push(item)
    this.refresh(item)

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      this.onClick?.(device)
    })
  }

  onClick?: (device: DeviceRecord) => void

  setStatus(device: DeviceRecord, status: DeviceStatus): void {
    const item = this.items.find((i) => i.device === device)
    if (item) this.paint(item, status)
  }

  private paint(item: { el: HTMLDivElement; device: DeviceRecord }, status: DeviceStatus): void {
    item.el.className = `tag s-${status}`
    const txt = item.el.querySelector('.txt') as HTMLSpanElement
    txt.textContent = `${item.device.name} · ${statusText(status)}`
  }

  private refresh(item: { el: HTMLDivElement; device: DeviceRecord }): void {
    this.paint(item, item.device.status)
  }

  /**
   * 每帧更新可见性。
   * 遮挡检测用一次 raycast，成本可控；设备数量 > 500 时应改用
   * 八叉树 / BVH 加速，或干脆降级为"仅距离剔除"。
   */
  update(): void {
    if (!this.visible) return

    this.camera.getWorldDirection(this.camDir)

    for (const item of this.items) {
      const d = this.camera.position.distanceTo(item.anchor)

      if (d > this.maxDistance) {
        item.el.style.opacity = '0'
        item.el.style.pointerEvents = 'none'
        continue
      }

      // 距离淡出
      const fade = 1 - Math.max(0, (d - this.maxDistance * 0.7) / (this.maxDistance * 0.3))

      // 遮挡检测：从相机向标签打一条射线，命中且命中点比标签近 → 被挡
      this.toLabel.copy(item.anchor).sub(this.camera.position).normalize()
      this.raycaster.set(this.camera.position, this.toLabel)
      this.raycaster.far = d + 1
      const hits = this.raycaster.intersectObjects(this.occluders, true)
      const occluded = hits.length > 0 && hits[0].distance < d - 0.6

      item.el.style.opacity = occluded ? String(0.12 * fade) : String(fade)
      item.el.style.pointerEvents = occluded ? 'none' : 'auto'
    }
  }

  setVisible(v: boolean): void {
    this.visible = v
    for (const item of this.items) {
      item.obj.visible = v
    }
  }

  dispose(): void {
    for (const item of this.items) {
      item.obj.removeFromParent()
      item.el.remove()
    }
    this.items.length = 0
  }
}
