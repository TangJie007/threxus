import * as THREE from 'three'
import { GLSL_FRESNEL, GLSL_NOISE } from './shaders'

/**
 * 管道流动效果（工业孪生里的"介质流向"）。
 * 继承 Mesh：作为场景节点直接 add，自带 update / dispose。
 */
export interface FlowPipeOptions {
  curve: THREE.Curve<THREE.Vector3>
  radius?: number
  tubularSegments?: number
  radialSegments?: number
  color?: THREE.ColorRepresentation
  speed?: number
  dashCount?: number
  flowEnabled?: boolean
}

export class FlowPipe extends THREE.Mesh {
  declare material: THREE.ShaderMaterial
  private readonly clockUniform: { value: number }

  constructor(opts: FlowPipeOptions) {
    const radius = opts.radius ?? 0.12
    const geo = new THREE.TubeGeometry(
      opts.curve,
      opts.tubularSegments ?? 160,
      radius,
      opts.radialSegments ?? 10,
      false,
    )

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(opts.color ?? 0x40e0ff) },
        uSpeed: { value: opts.speed ?? 0.35 },
        uDash: { value: opts.dashCount ?? 14 },
        uFlow: { value: opts.flowEnabled === false ? 0 : 1 },
        uBase: { value: 0.16 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main(){
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uSpeed;
        uniform float uDash;
        uniform float uFlow;
        uniform float uBase;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewW;

        ${GLSL_NOISE}
        ${GLSL_FRESNEL}

        void main(){
          float t = fract(vUv.x * uDash - uTime * uSpeed);
          float hw = max(0.06, fwidth(t) * 1.5);
          float band = smoothstep(0.0, hw, t) * (1.0 - smoothstep(hw, 0.42, t));

          float t2 = fract(vUv.x * uDash * 0.5 - uTime * uSpeed * 1.7 + 0.35);
          float hw2 = max(0.03, fwidth(t2) * 1.5);
          float band2 = (1.0 - smoothstep(0.0, hw2, abs(t2 - 0.5))) * 0.6;

          float n = fbm2(vec2(vUv.x * 8.0 - uTime * uSpeed * 2.0, vUv.y * 3.0)) * 0.25;
          float rim = fresnel(vNormalW, vViewW, 2.2);

          float energy = uBase + (band + band2) * uFlow * 1.5 + rim * 0.55 + n * 0.15;
          vec3 col = uColor * energy;
          float alpha = clamp(0.30 + band * 0.65 * uFlow + rim * 0.45, 0.0, 1.0);

          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      toneMapped: false,
    })

    super(geo, material)
    this.clockUniform = material.uniforms.uTime
    this.castShadow = false
    this.receiveShadow = false
  }

  set flowEnabled(v: boolean) {
    this.material.uniforms.uFlow.value = v ? 1 : 0
  }

  get flowEnabled(): boolean {
    return this.material.uniforms.uFlow.value > 0.5
  }

  setColor(c: THREE.ColorRepresentation): void {
    ;(this.material.uniforms.uColor.value as THREE.Color).set(c)
  }

  update(delta: number): void {
    this.clockUniform.value += delta
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/** 沿路径生成一段自动绕行的管线（厂房管廊常用） */
export function makePipeCurve(points: [number, number, number][]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.4,
  )
}
