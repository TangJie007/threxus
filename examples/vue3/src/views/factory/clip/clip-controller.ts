import * as THREE from 'three'

/**
 * 剖切平面（Clipping Planes）。
 * 工业孪生：切开厂房看内部管廊 / 设备腔体。
 */
export class ClipController {
  readonly plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 6)
  private materials: THREE.Material[] = []
  private enabled = false

  register(materials: THREE.Material[]): void {
    this.materials = materials
  }

  setEnabled(v: boolean): void {
    this.enabled = v
    this.apply()
  }

  setHeight(h: number): void {
    this.plane.constant = h
    if (this.enabled) this.apply()
  }

  private apply(): void {
    const planes = this.enabled ? [this.plane] : null
    for (const m of this.materials) {
      m.clippingPlanes = planes
      m.clipShadows = true
      m.needsUpdate = true
    }
  }
}
