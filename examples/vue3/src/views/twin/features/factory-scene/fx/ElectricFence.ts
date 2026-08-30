import * as THREE from 'three'
import { GLSL_FRESNEL, GLSL_NOISE } from './shaders'

/**
 * 电子围栏 / 安全区边界。
 *
 * 工业场景里用来圈出危险作业区（机器人工作范围、高压区）。
 * 关键细节：
 *  - side: DoubleSide + depthWrite:false —— 从内外两侧都能看到，且不遮挡内部设备
 *  - 六边形网格纹路而不是纯色 —— 纯色半透明面在复杂背景下几乎看不见
 *  - 底部实、顶部虚的垂直渐变 —— 制造"从地面长出来"的观感
 */
export class ElectricFence extends THREE.Mesh {
  declare material: THREE.ShaderMaterial

  constructor(opts: {
    width: number
    depth: number
    height?: number
    color?: THREE.ColorRepresentation
  }) {
    const h = opts.height ?? 2.6
    // openEnded 圆柱体当围栏"墙"不合适，这里用 BoxGeometry 的 5 个面中的 4 个侧面更贴切；
    // 但为了单一 drawcall，直接用 Box 并靠 shader 把上下面的 alpha 压到 0。
    const geo = new THREE.BoxGeometry(opts.width, h, opts.depth, 1, 1, 1)
    geo.translate(0, h / 2, 0)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(opts.color ?? 0x40e0ff) },
        uHeight: { value: h },
        uOpacity: { value: 1 },
        uGridScale: { value: 2.2 },
        uAlert: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vLocal;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main(){
          vLocal = position;
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uHeight, uOpacity, uGridScale, uAlert;
        uniform vec3  uColor;
        varying vec3 vLocal;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        ${GLSL_NOISE}
        ${GLSL_FRESNEL}

        // 六边形网格距离场：比方格纹更有"科技防护"感
        float hexGrid(vec2 p){
          p *= uGridScale;
          vec2 s = vec2(1.0, 1.7320508);
          vec2 a = mod(p, s) - s * 0.5;
          vec2 b = mod(p + s * 0.5, s) - s * 0.5;
          vec2 gv = dot(a, a) < dot(b, b) ? a : b;
          float d = abs(max(abs(gv.x) * 0.8660254 + gv.y * 0.5, gv.y));
          return smoothstep(0.46, 0.5, d);
        }

        void main(){
          // 顶面和底面完全隐藏（这是个"墙"不是"盒子"）
          float isSide = 1.0 - abs(normalize(vNormalW + vLocal * 0.0001).y);
          // 用法线的世界 Y 分量判断更简单可靠
          float ny = abs(vNormalW.y);
          float sideMask = 1.0 - smoothstep(0.3, 0.7, ny);

          // 垂直渐隐
          float vert = pow(vUv.y, 1.5);

          // 六边形网格：用世界坐标投影，保证相邻面纹路连续
          vec2 p = vec2(vLocal.x + vLocal.z, vLocal.y);
          float grid = hexGrid(p);

          // 向上滚动的扫描线
          float scan = fract(vLocal.y * 0.5 - uTime * 0.55);
          float scanBand = smoothstep(0.0, 0.06, scan) * (1.0 - smoothstep(0.06, 0.20, scan));

          // 告警时闪烁
          float blink = mix(1.0, 0.45 + 0.55 * step(0.5, fract(uTime * 2.2)), uAlert);
          vec3 col = mix(uColor, vec3(1.0, 0.28, 0.34), uAlert);

          float rim = fresnel(vNormalW, vViewW, 2.0);

          float a = (grid * 0.32 + scanBand * 0.55 + rim * 0.35 + 0.04) * vert * sideMask * uOpacity * blink;
          if(a < 0.003) discard;

          gl_FragColor = vec4(col * (1.3 + scanBand), clamp(a, 0.0, 1.0));
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    })

    super(geo, material)
    this.renderOrder = 4
    // 装饰性特效：不开启拾取层，射线自动忽略
  }

  update(delta: number): void {
    this.material.uniforms.uTime.value += delta
  }

  set alert(v: boolean) {
    this.material.uniforms.uAlert.value = v ? 1 : 0
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * 剖切平面（Clipping Planes）。
 * 工业孪生的刚需：看设备内部腔体、看多层管廊的走向。
 * 用法：把 clippingPlanes 数组挂到材质上，renderer.localClippingEnabled = true。
 */
export class ClipController {
  readonly plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 6)
  private materials: THREE.Material[] = []
  private enabled = false

  /** 注册需要被剖切影响的材质（必须全量注册，漏一个就会看到"切了一半"的穿帮） */
  register(materials: THREE.Material[]): void {
    this.materials = materials
  }

  setEnabled(v: boolean): void {
    this.enabled = v
    this.apply()
  }

  /** height: 剖切高度，低于该高度的部分被保留 */
  setHeight(h: number): void {
    this.plane.constant = h
    if (this.enabled) this.apply()
  }

  private apply(): void {
    const planes = this.enabled ? [this.plane] : null
    for (const m of this.materials) {
      m.clippingPlanes = planes
      m.clipShadows = true
      m.needsUpdate = true // 改 clippingPlanes 数量必须触发重编译
    }
  }
}
