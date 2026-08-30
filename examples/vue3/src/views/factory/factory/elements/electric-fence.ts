import * as THREE from 'three'
import { GLSL_FRESNEL, GLSL_NOISE } from '../shaders'

/**
 * 电子围栏 / 安全区边界。
 * 继承 Mesh：作为场景节点直接 add。
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
          float ny = abs(vNormalW.y);
          float sideMask = 1.0 - smoothstep(0.3, 0.7, ny);
          float vert = pow(vUv.y, 1.5);
          vec2 p = vec2(vLocal.x + vLocal.z, vLocal.y);
          float grid = hexGrid(p);
          float scan = fract(vLocal.y * 0.5 - uTime * 0.55);
          float scanBand = smoothstep(0.0, 0.06, scan) * (1.0 - smoothstep(0.06, 0.20, scan));
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
  }

  update(delta: number): void {
    this.material.uniforms.uTime.value += delta
  }

  set alert(v: boolean) {
    this.material.uniforms.uAlert.value = v ? 1 : 0
  }

  get alert(): boolean {
    return this.material.uniforms.uAlert.value > 0.5
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
