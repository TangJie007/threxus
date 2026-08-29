import * as THREE from 'three'
import GUI from 'lil-gui'
import type { Viewer } from '@/core/Viewer'
import type { Composer } from '@/core/Composer'
import type { Factory } from '@/scene/Factory'
import type { Environment } from '@/scene/Environment'
import type { CameraRig } from '@/interaction/CameraRig'
import type { Labels } from '@/interaction/Labels'

export interface DebugHandles {
  viewer: Viewer
  composer: Composer
  factory: Factory
  environment: Environment
  rig: CameraRig
  labels: Labels
  onSnapshot: () => void
}

/**
 * 调试面板。
 * 工业项目里 lil-gui 不是玩具 —— 现场实施时，客户总会要求
 * "这个光再亮一点""AO 太重了"，没有实时调参面板就只能改代码重编译。
 * 定位为「交付工具」而不是「开发工具」，才会认真去组织它的分组。
 */
export function createDebug(h: DebugHandles): GUI {
  const gui = new GUI({ title: '孪生调试台', width: 268 })
  gui.domElement.style.top = '60px'
  gui.domElement.style.right = '14px'
  gui.domElement.style.position = 'absolute'

  // ---------------- 渲染 ----------------
  const fRender = gui.addFolder('渲染 Renderer')
  const renderState = {
    exposure: h.viewer.renderer.toneMappingExposure,
    pixelRatio: h.viewer.renderer.getPixelRatio(),
    toneMapping: 'ACESFilmic',
    onDemand: h.viewer.onDemand,
    shadows: h.viewer.renderer.shadowMap.enabled,
  }
  fRender
    .add(renderState, 'exposure', 0.2, 2.5, 0.01)
    .name('曝光')
    .onChange((v: number) => {
      h.viewer.renderer.toneMappingExposure = v
      h.viewer.invalidate()
    })
  fRender
    .add(renderState, 'pixelRatio', 0.5, 3, 0.1)
    .name('像素比 (性能)')
    .onChange((v: number) => {
      h.viewer.renderer.setPixelRatio(v)
      h.viewer.onResize?.(h.viewer.container.clientWidth, h.viewer.container.clientHeight)
      h.viewer.invalidate()
    })
  fRender
    .add(renderState, 'toneMapping', ['ACESFilmic', 'AgX', 'Neutral', 'Reinhard', 'Linear'])
    .name('色调映射')
    .onChange((v: string) => {
      const map: Record<string, THREE.ToneMapping> = {
        ACESFilmic: THREE.ACESFilmicToneMapping,
        AgX: THREE.AgXToneMapping,
        Neutral: THREE.NeutralToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Linear: THREE.LinearToneMapping,
      }
      h.viewer.renderer.toneMapping = map[v]
      h.viewer.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m) m.needsUpdate = true
      })
      h.viewer.invalidate()
    })
  fRender
    .add(renderState, 'shadows')
    .name('阴影')
    .onChange((v: boolean) => {
      h.viewer.renderer.shadowMap.enabled = v
      h.viewer.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m) m.needsUpdate = true
      })
      h.viewer.invalidate()
    })
  fRender.add(renderState, 'onDemand').name('按需渲染').onChange((v: boolean) => {
    h.viewer.onDemand = v
  })
  fRender.close()

  // ---------------- 后处理 ----------------
  const fPost = gui.addFolder('后处理 Post')
  fPost.add(h.composer.toggles, 'ao').name('GTAO 环境光遮蔽').onChange((v: boolean) => {
    h.composer.setEnabled('ao', v)
    h.viewer.invalidate()
  })
  fPost.add(h.composer.toggles, 'bloom').name('Bloom 辉光').onChange((v: boolean) => {
    h.composer.setEnabled('bloom', v)
    h.viewer.invalidate()
  })
  fPost.add(h.composer.toggles, 'outline').name('Outline 描边').onChange((v: boolean) => {
    h.composer.setEnabled('outline', v)
    h.viewer.invalidate()
  })
  fPost.add(h.composer.toggles, 'fxaa').name('FXAA 抗锯齿').onChange((v: boolean) => {
    h.composer.setEnabled('fxaa', v)
    h.viewer.invalidate()
  })
  if (h.composer.aoPass) {
    const ao = h.composer.aoPass
    const aoState = { intensity: ao.blendIntensity, radius: 0.6 }
    fPost.add(aoState, 'intensity', 0, 2, 0.05).name('AO 强度').onChange((v: number) => {
      ao.blendIntensity = v
      h.viewer.invalidate()
    })
    fPost.add(aoState, 'radius', 0.05, 2, 0.05).name('AO 半径').onChange((v: number) => {
      ao.updateGtaoMaterial({ radius: v })
      h.viewer.invalidate()
    })
  }
  const b = h.composer.bloomPass
  const bState = { strength: b.strength, radius: b.radius, threshold: b.threshold }
  fPost.add(bState, 'strength', 0, 2, 0.01).name('辉光强度').onChange((v: number) => {
    b.strength = v
    h.viewer.invalidate()
  })
  fPost.add(bState, 'radius', 0, 1.5, 0.01).name('辉光半径').onChange((v: number) => {
    b.radius = v
    h.viewer.invalidate()
  })
  fPost.add(bState, 'threshold', 0, 1.5, 0.01).name('辉光阈值').onChange((v: number) => {
    b.threshold = v
    h.viewer.invalidate()
  })
  fPost.close()

  // ---------------- 光照 ----------------
  const fLight = gui.addFolder('光照 Lighting')
  const lightState = {
    env: h.viewer.scene.environmentIntensity ?? 0.85,
    sun: h.environment.sun.intensity,
    hemi: h.environment.hemi.intensity,
    fill: h.environment.fill.intensity,
  }
  fLight.add(lightState, 'env', 0, 2.5, 0.05).name('环境反射强度').onChange((v: number) => {
    h.viewer.scene.environmentIntensity = v
    h.viewer.invalidate()
  })
  fLight.add(lightState, 'sun', 0, 5, 0.05).name('主光').onChange((v: number) => {
    h.environment.sun.intensity = v
    h.viewer.invalidate()
  })
  fLight.add(lightState, 'hemi', 0, 2, 0.05).name('半球光').onChange((v: number) => {
    h.environment.hemi.intensity = v
    h.viewer.invalidate()
  })
  fLight.add(lightState, 'fill', 0, 2, 0.05).name('补光').onChange((v: number) => {
    h.environment.fill.intensity = v
    h.viewer.invalidate()
  })
  fLight.close()

  // ---------------- 场景 ----------------
  const fScene = gui.addFolder('场景 Scene')
  const sceneState = {
    flow: true,
    fenceAlert: false,
    labels: true,
    labelDist: h.labels.maxDistance,
    scan: true,
  }
  fScene.add(sceneState, 'flow').name('管道流动').onChange((v: boolean) => {
    h.factory.setFlowEnabled(v)
    h.viewer.invalidate()
  })
  fScene.add(sceneState, 'fenceAlert').name('围栏告警').onChange((v: boolean) => {
    h.factory.setFenceAlert(v)
  })
  fScene.add(sceneState, 'scan').name('地面扫描').onChange((v: boolean) => {
    h.factory.scanRing.visible = v
    h.viewer.invalidate()
  })
  fScene.add(sceneState, 'labels').name('设备标签').onChange((v: boolean) => {
    h.labels.setVisible(v)
  })
  fScene.add(sceneState, 'labelDist', 20, 140, 5).name('标签可见距离').onChange((v: number) => {
    h.labels.maxDistance = v
  })
  fScene.close()

  // ---------------- 相机 ----------------
  const fCam = gui.addFolder('相机 Camera')
  const camState = { mode: 'orbit', fov: h.viewer.camera.fov }
  fCam
    .add(camState, 'mode', ['orbit', 'roam'])
    .name('模式')
    .onChange((v: string) => {
      h.rig.setMode(v as 'orbit' | 'roam')
      syncToolbar('mode', v)
    })
  fCam.add(camState, 'fov', 20, 90, 1).name('视场角').onChange((v: number) => {
    h.viewer.camera.fov = v
    h.viewer.camera.updateProjectionMatrix()
    h.viewer.invalidate()
  })
  fCam.add({ reset: () => h.rig.flyTo(new THREE.Vector3(0, 3, 0), 40, 26) }, 'reset').name('回到全景')
  fCam.close()

  // ---------------- 操作 ----------------
  gui.add({ snap: h.onSnapshot }, 'snap').name('📷 导出截图')
  gui.add({ dispose: () => h.viewer.dispose() }, 'dispose').name('⚠ 销毁并释放显存')

  return gui
}

function syncToolbar(kind: string, value: string): void {
  document.querySelectorAll<HTMLButtonElement>(`#toolbar button[data-mode]`).forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === value)
  })
  void kind
}
