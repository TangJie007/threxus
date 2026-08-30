import * as THREE from 'three'
import { GLSL_FRESNEL, GLSL_NOISE } from './shaders'

/**
 * 地面扫描波（设备定位 / 告警扩散）。
 * 继承 Mesh：作为场景节点直接 add。
 */
export class ScanRing extends THREE.Mesh {
  declare material: THREE.ShaderMaterial

  constructor(radius = 30, color: THREE.ColorRepresentation = 0x40e0ff) {
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1)
    geo.rotateX(-Math.PI / 2)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uRadius: { value: radius },
        uSpeed: { value: 0.35 },
        uRings: { value: 3.0 },
        uWidth: { value: 0.9 },
        uIntensity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main(){
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uRadius, uSpeed, uRings, uWidth, uIntensity;
        uniform vec3  uColor;
        varying vec2 vPos;
        ${GLSL_NOISE}

        void main(){
          float dist = length(vPos);
          float edgeFade = 1.0 - smoothstep(uRadius * 0.75, uRadius, dist);
          float acc = 0.0;
          for(int i = 0; i < 3; i++){
            float phase = fract(uTime * uSpeed - float(i) / uRings);
            float ringR = phase * uRadius;
            float d = abs(dist - ringR);
            float w = max(uWidth * 0.5, fwidth(dist) * 1.2);
            float ring = 1.0 - smoothstep(0.0, w, d);
            ring *= 1.0 - phase;
            acc += ring;
          }
          float grid = 1.0 - smoothstep(0.0, max(0.06, fwidth(dist)), abs(fract(dist / 5.0) - 0.5) * 5.0 - 2.3);
          float noise = noise2(vPos * 0.35 + uTime * 0.05) * 0.12;
          float a = (acc * 0.85 + grid * 0.10 + noise) * edgeFade * uIntensity;
          if(a < 0.002) discard;
          gl_FragColor = vec4(uColor * (1.2 + acc), a);
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
    this.renderOrder = 2
  }

  update(delta: number): void {
    this.material.uniforms.uTime.value += delta
  }

  setColor(c: THREE.ColorRepresentation): void {
    ;(this.material.uniforms.uColor.value as THREE.Color).set(c)
  }

  focusAt(x: number, z: number): void {
    this.position.set(x, 0.02, z)
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * 垂直告警光柱。
 */
export class AlertBeacon extends THREE.Mesh {
  declare material: THREE.ShaderMaterial

  constructor(
    height = 8,
    radius = 0.55,
    color: THREE.ColorRepresentation = 0xff4d5e,
  ) {
    const geo = new THREE.CylinderGeometry(radius * 0.55, radius, height, 16, 1, true)
    geo.translate(0, height / 2, 0)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewW = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity;
        uniform vec3  uColor;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vViewW;
        ${GLSL_FRESNEL}

        void main(){
          float vert = pow(1.0 - vUv.y, 1.6);
          float flow = fract(vUv.y * 3.0 - uTime * 0.9);
          float band = smoothstep(0.0, 0.35, flow) * (1.0 - smoothstep(0.35, 0.8, flow));
          float rim = fresnel(vNormalW, vViewW, 1.6);
          float pulse = 0.75 + 0.25 * sin(uTime * 4.0);
          float a = (vert * 0.35 + band * 0.45 + rim * 0.3) * uOpacity * pulse;
          gl_FragColor = vec4(uColor * 1.6, clamp(a, 0.0, 1.0));
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
    this.renderOrder = 3
    this.visible = false
  }

  update(delta: number): void {
    this.material.uniforms.uTime.value += delta
  }

  setColor(c: THREE.ColorRepresentation): void {
    ;(this.material.uniforms.uColor.value as THREE.Color).set(c)
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
