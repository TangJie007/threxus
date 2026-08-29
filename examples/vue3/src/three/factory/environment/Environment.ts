/**
 * 程序化工业环境（自 examples/test 迁入，适配 Threxus 注入的 Scene / Renderer）。
 *
 * PBR 金属的观感 90% 来自环境反射，而不是直接光。
 * 顶部灯带会在设备曲面上拉出长条形高光 —— 这正是真实厂房里的视觉特征。
 */

import * as THREE from 'three';

export interface EnvironmentOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  /** 厂区尺寸，用于计算阴影相机范围 */
  bounds: { width: number; depth: number; height: number };
}

/**
 * 带顶部灯带的房间，用 PMREM 烘成环境贴图。
 * 烘完后立即 dispose 临时场景 —— 运行时只保留那张 envMap。
 */
function buildFactoryEnvScene(): THREE.Scene {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x1a2129);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.deleteAttribute('uv');

  const shell = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x2a323c }),
  );
  shell.scale.set(32, 16, 32);
  shell.position.y = 6;
  s.add(shell);

  const floor = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0x14181d }),
  );
  floor.scale.set(30, 0.2, 30);
  floor.position.y = -1.9;
  s.add(floor);

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j += 2) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.scale.set(13, 0.5, 0.9);
      lamp.position.set(j * 5.5, 13.2, i * 8);
      s.add(lamp);
    }
  }

  const warm = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xff9a4d }),
  );
  warm.scale.set(0.4, 5, 22);
  warm.position.set(-14.5, 4, 0);
  s.add(warm);

  const cool = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0x4da6ff }),
  );
  cool.scale.set(0.4, 5, 22);
  cool.position.set(14.5, 4, 0);
  s.add(cool);

  return s;
}

function disposeScene(s: THREE.Scene): void {
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
  });
  s.clear();
}

export class Environment {
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  envMap: THREE.Texture | null = null;

  private readonly pmrem: THREE.PMREMGenerator;

  constructor(private readonly opts: EnvironmentOptions) {
    const { scene, renderer, bounds } = opts;

    // ---------- 渲染器色彩管理 + 阴影（ThreeCore 默认未开） ----------
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // ---------- 背景与雾 ----------
    scene.background = new THREE.Color(0x0a0f16);
    scene.fog = new THREE.Fog(0x0a0f16, 60, 190);

    // ---------- 环境贴图 ----------
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    const envScene = buildFactoryEnvScene();
    this.envMap = this.pmrem.fromScene(envScene, 0.035).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.85;
    disposeScene(envScene);

    // ---------- 灯光 ----------
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x1a1f26, 0.35);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(28, 42, 22);
    this.sun.castShadow = true;

    const r = Math.max(bounds.width, bounds.depth) * 0.62;
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 140;
    cam.updateProjectionMatrix();

    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0x87b4ff, 0.28);
    this.fill.position.set(-24, 16, -20);
    scene.add(this.fill);
  }

  dispose(): void {
    const { scene } = this.opts;
    scene.environment = null;
    scene.fog = null;
    scene.remove(this.hemi, this.sun, this.sun.target, this.fill);
    this.envMap?.dispose();
    this.envMap = null;
    this.pmrem.dispose();
    this.hemi.dispose();
    this.sun.dispose();
    this.fill.dispose();
  }
}
