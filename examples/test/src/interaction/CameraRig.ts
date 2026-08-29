import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type CameraMode = 'orbit' | 'roam'

interface Tween {
  from: THREE.Vector3
  to: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  t: number
  duration: number
}

/**
 * 相机运镜。工业孪生里相机的体验标准：
 *  - 点设备列表 → 平滑飞过去，而不是瞬移（瞬移会让用户失去空间感）
 *  - 巡检模式 → 沿固定路线自动巡航，用于投屏到车间大屏
 *  - 任何运镜期间都要禁用 OrbitControls，否则用户输入和动画会打架
 */
export class CameraRig {
  mode: CameraMode = 'orbit'

  private tween: Tween | null = null
  private roamT = 0
  private readonly roamCurve: THREE.CatmullRomCurve3
  private readonly tmp = new THREE.Vector3()

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
  ) {
    this.roamCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-42, 6, 30),
        new THREE.Vector3(-20, 5, 26),
        new THREE.Vector3(10, 7, 28),
        new THREE.Vector3(38, 5, 20),
        new THREE.Vector3(42, 9, -6),
        new THREE.Vector3(20, 6, -26),
        new THREE.Vector3(-12, 8, -28),
        new THREE.Vector3(-40, 6, -8),
      ],
      true,
      'catmullrom',
      0.5,
    )
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
    if (mode === 'roam') {
      this.controls.enabled = false
      // 从当前角度切入巡检路线，避免视角突跳
      this.roamT = this.nearestRoamT(this.camera.position)
    } else {
      this.controls.enabled = true
      this.tween = null
    }
  }

  private nearestRoamT(p: THREE.Vector3): number {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < 100; i++) {
      const t = i / 100
      const d = this.roamCurve.getPointAt(t, this.tmp).distanceToSquared(p)
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    return best
  }

  /**
   * 飞向目标。
   * @param target  要看的点
   * @param distance 站位距离
   * @param height   站位高度
   */
  flyTo(target: THREE.Vector3, distance = 12, height = 8, duration = 0.9): void {
    if (this.mode === 'roam') this.setMode('orbit')

    // 保留当前方位角，只调整距离和高度 —— 这样用户不会迷失方向
    const dir = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .setY(0)
    if (dir.lengthSq() < 0.001) dir.set(1, 0, 1)
    dir.normalize()

    const to = new THREE.Vector3(
      target.x + dir.x * distance,
      target.y + height,
      target.z + dir.z * distance,
    )

    this.tween = {
      from: this.camera.position.clone(),
      to,
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      t: 0,
      duration,
    }
    this.controls.enabled = false
  }

  update(delta: number, elapsed: number): void {
    if (this.mode === 'roam') {
      this.roamT = (this.roamT + delta * 0.012) % 1
      this.roamCurve.getPointAt(this.roamT, this.tmp)
      this.camera.position.copy(this.tmp)
      // 视线始终看向厂区中心，并带一点缓慢的正弦摆动，避免画面太死
      this.camera.lookAt(
        Math.sin(elapsed * 0.12) * 10,
        3 + Math.sin(elapsed * 0.09) * 1.2,
        Math.cos(elapsed * 0.1) * 8,
      )
      return
    }

    if (this.tween) {
      const tw = this.tween
      tw.t += delta
      const k = Math.min(tw.t / tw.duration, 1)
      const e = easeInOutCubic(k)
      this.camera.position.lerpVectors(tw.from, tw.to, e)
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
      if (k >= 1) {
        this.tween = null
        this.controls.enabled = true
      }
    }
  }

  get busy(): boolean {
    return this.tween !== null || this.mode === 'roam'
  }
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
