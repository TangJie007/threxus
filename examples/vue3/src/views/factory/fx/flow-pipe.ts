import * as THREE from 'three'
import type { FlowController } from '../types'
import { GLSL_FRESNEL, GLSL_NOISE } from './shaders'

/**
 * 管道流动效果（工业孪生里的"介质流向"）。
 *
 * 技术要点：
 * - 用 TubeGeometry，其 uv.x 沿管道走向分布、uv.y 绕管一圈 —— 天然适合做流动带
 * - 流动用 fract(uv.x * count - time * speed) 实现，零贴图依赖
 * - 叠加菲涅尔让管子边缘发亮，避免看起来像一根塑料吸管
 * - transparent + depthWrite:false + AdditiveBlending，且不投影不接收阴影
 * - 用 fwidth 做自适应抗锯齿，远处不会出现摩尔纹闪烁
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

export function createFlowPipe(opts: FlowPipeOptions): FlowController {
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
        // 主体流动带：沿管道方向推进
        float t = fract(vUv.x * uDash - uTime * uSpeed);
        float hw = max(0.06, fwidth(t) * 1.5);
        float band = smoothstep(0.0, hw, t) * (1.0 - smoothstep(hw, 0.42, t));

        // 第二条更快的细带，制造层次
        float t2 = fract(vUv.x * uDash * 0.5 - uTime * uSpeed * 1.7 + 0.35);
        float hw2 = max(0.03, fwidth(t2) * 1.5);
        float band2 = (1.0 - smoothstep(0.0, hw2, abs(t2 - 0.5))) * 0.6;

        // 轻微流动扰动，避免机械感
        float n = fbm2(vec2(vUv.x * 8.0 - uTime * uSpeed * 2.0, vUv.y * 3.0)) * 0.25;

        float rim = fresnel(vNormalW, vViewW, 2.2);

        float energy = uBase + (band + band2) * uFlow * 1.5 + rim * 0.55 + n * 0.15;
        vec3 col = uColor * energy;

        // 透明管道的 alpha 也要跟着能量走，否则暗部会变成一团灰
        float alpha = clamp(0.30 + band * 0.65 * uFlow + rim * 0.45, 0.0, 1.0);

        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    toneMapped: false, // 让它冲破 1.0，Bloom 才有东西可提
  })

  const root = new THREE.Mesh(geo, material)
  root.castShadow = false
  root.receiveShadow = false
  // 不调用 markPickable，即不开启第 1 层 —— 拾取射线只测第 1 层，天然排除装饰物

  const clockUniform = material.uniforms.uTime

  return {
    root,
    get flowEnabled() {
      return material.uniforms.uFlow.value > 0.5
    },
    set flowEnabled(v: boolean) {
      material.uniforms.uFlow.value = v ? 1 : 0
    },
    update(delta: number) {
      clockUniform.value += delta
    },
    dispose() {
      geo.dispose()
      material.dispose()
    },
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
