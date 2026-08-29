import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js'

export interface PassToggles {
  ao: boolean
  bloom: boolean
  outline: boolean
  fxaa: boolean
}

/**
 * 后处理管线。顺序是有讲究的：
 *
 *   RenderPass → GTAO → Bloom → Outline → FXAA → OutputPass
 *
 * - GTAO 必须紧跟 RenderPass：它需要重建法线/深度 G-Buffer
 * - Bloom 放在 AO 之后：AO 压暗的是环境光遮蔽，不该被辉光洗掉
 * - Outline 放在 Bloom 之后：选中描边要锐利，不能被辉光糊掉
 * - FXAA 在 OutputPass 之前：抗锯齿要在 sRGB 编码前的线性空间做
 * - OutputPass 永远最后：它负责 tone mapping + sRGB 编码
 *   （渲染到 RT 时材质里的 tonemapping 是关闭的，全靠这一 pass 收尾）
 */
export class Composer {
  readonly composer: EffectComposer
  readonly renderPass: RenderPass
  readonly aoPass?: GTAOPass
  readonly bloomPass: UnrealBloomPass
  readonly outlinePass: OutlinePass
  readonly fxaaPass: FXAAPass
  readonly outputPass: OutputPass

  readonly toggles: PassToggles = {
    ao: true,
    bloom: true,
    outline: true,
    fxaa: true,
  }

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ) {
    const size = renderer.getSize(new THREE.Vector2())

    // HalfFloat 是硬要求：Bloom 需要 >1 的 HDR 值才能正确提取高光
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4, // MSAA，配合 FXAA 处理几何边缘和着色器边缘
    })
    this.composer = new EffectComposer(renderer, rt)
    this.composer.setPixelRatio(renderer.getPixelRatio())
    this.composer.setSize(size.x, size.y)

    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)

    // ---- GTAO：比 SSAO 质量高很多，工业设备密集的缝隙里效果差距最明显 ----
    try {
      const ao = new GTAOPass(scene, camera, size.x, size.y)
      ao.output = 0 // GTAOPass.OUTPUT.Default
      ao.blendIntensity = 0.85
      ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.0, scale: 1.0 })
      this.composer.addPass(ao)
      this.aoPass = ao
    } catch (e) {
      console.warn('[Composer] GTAO 不可用，已跳过', e)
    }

    // ---- Bloom：让自发光（指示灯、屏幕、流动管道）真正"发光" ----
    this.bloomPass = new UnrealBloomPass(size.clone(), 0.55, 0.7, 0.85)
    this.composer.addPass(this.bloomPass)

    // ---- Outline：设备选中高亮 ----
    this.outlinePass = new OutlinePass(size.clone(), scene, camera)
    this.outlinePass.edgeStrength = 4.5
    this.outlinePass.edgeGlow = 0.4
    this.outlinePass.edgeThickness = 1.6
    this.outlinePass.pulsePeriod = 0
    this.outlinePass.visibleEdgeColor.set('#40e0ff')
    this.outlinePass.hiddenEdgeColor.set('#0a3f52')
    this.composer.addPass(this.outlinePass)

    this.fxaaPass = new FXAAPass()
    this.composer.addPass(this.fxaaPass)

    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    this.applyToggles()
  }

  setEnabled(name: keyof PassToggles, on: boolean): void {
    this.toggles[name] = on
    this.applyToggles()
  }

  private applyToggles(): void {
    if (this.aoPass) this.aoPass.enabled = this.toggles.ao
    this.bloomPass.enabled = this.toggles.bloom
    this.outlinePass.enabled = this.toggles.outline
    this.fxaaPass.enabled = this.toggles.fxaa
  }

  /** 设置描边目标（传空数组 = 取消高亮） */
  select(objects: THREE.Object3D[]): void {
    this.outlinePass.selectedObjects = objects
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h)
    const pr = this.renderer.getPixelRatio()
    this.bloomPass.setSize(w * pr, h * pr)
    this.outlinePass.setSize(w * pr, h * pr)
  }

  render(delta: number): void {
    this.composer.render(delta)
  }

  dispose(): void {
    this.composer.renderTarget1.dispose()
    this.composer.renderTarget2.dispose()
    this.aoPass?.dispose()
    this.bloomPass.dispose()
    this.outlinePass.dispose()
    this.fxaaPass.dispose()
    this.outputPass.dispose()
  }
}
