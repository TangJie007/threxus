import * as THREE from 'three'
import type { ScanRingController } from '../types'
import { GLSL_FRESNEL, GLSL_NOISE } from './shaders'

export interface AlertBeaconHandle {
  readonly root: THREE.Object3D
  update(delta: number): void
  dispose(): void
}

/**
 * 地面扫描波（设备定位 / 告警扩散）。
 *
 * 两种做法的取舍：
 *  A. 用 RingGeometry + 每帧改 scale/opacity —— 简单，但边缘缩放后线宽会变，且无法做多环
 *  B. 用一个覆盖全场的 Plane + shader 里算距离场 —— 线宽恒定、可多环叠加、零 GC
 * 工业项目选 B：一个 drawcall 出 N 环，且不会因为相机拉远而失真。
 */
export function createScanRing(
  radius = 30,
  color: THREE.ColorRepresentation = 0x40e0ff,
): ScanRingController {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1)
  geo.rotateX(-Math.PI / 2) // 平面默认朝 +Z，旋转成水平地面

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
        vPos = position.xy; // 已在几何体阶段旋转，这里 xy 即水平面坐标
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

        // 边缘整体淡出，避免平面边界出现硬切
        float edgeFade = 1.0 - smoothstep(uRadius * 0.75, uRadius, dist);

        // 多环：每环相位错开 1/uRings
        float acc = 0.0;
        for(int i = 0; i < 3; i++){
          float phase = fract(uTime * uSpeed - float(i) / uRings);
          float ringR = phase * uRadius;
          float d = abs(dist - ringR);
          // fwidth 自适应线宽：远处不会闪烁，近处不会糊
          float w = max(uWidth * 0.5, fwidth(dist) * 1.2);
          float ring = 1.0 - smoothstep(0.0, w, d);
          // 环随时间外扩而变淡
          ring *= 1.0 - phase;
          acc += ring;
        }

        // 同心刻度圈：强化"雷达"感
        float grid = 1.0 - smoothstep(0.0, max(0.06, fwidth(dist)), abs(fract(dist / 5.0) - 0.5) * 5.0 - 2.3);

        float noise = noise2(vPos * 0.35 + uTime * 0.05) * 0.12;

        float a = (acc * 0.85 + grid * 0.10 + noise) * edgeFade * uIntensity;
        if(a < 0.002) discard; // 早退，省掉大量无意义混合

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

  const root = new THREE.Mesh(geo, material)
  root.renderOrder = 2
  // 装饰性特效：不开启拾取层，射线自动忽略

  return {
    root,
    update(delta: number) {
      material.uniforms.uTime.value += delta
    },
    focusAt(x: number, z: number) {
      root.position.set(x, 0.02, z)
    },
    dispose() {
      geo.dispose()
      material.dispose()
    },
  }
}

/**
 * 垂直光柱：设备告警时从地面升起的光柱，比单纯改颜色更容易在远处被注意到。
 * 顶部渐隐 + 底部实心，是工业看板里标识异常点的标准做法。
 */
export function createAlertBeacon(
  height = 8,
  radius = 0.55,
  color: THREE.ColorRepresentation = 0xff4d5e,
): AlertBeaconHandle {
  const geo = new THREE.CylinderGeometry(radius * 0.55, radius, height, 16, 1, true)
  geo.translate(0, height / 2, 0) // 让 pivot 在底部，方便按高度缩放

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
        // 自下而上：底部实、顶部虚
        float vert = pow(1.0 - vUv.y, 1.6);
        // 向上流动的能量条
        float flow = fract(vUv.y * 3.0 - uTime * 0.9);
        float band = smoothstep(0.0, 0.35, flow) * (1.0 - smoothstep(0.35, 0.8, flow));
        // 掠射角增强，让圆柱边缘亮起来
        float rim = fresnel(vNormalW, vViewW, 1.6);
        // 整体呼吸
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

  const root = new THREE.Mesh(geo, material)
  root.renderOrder = 3
  root.visible = false
  // 装饰性特效：不开启拾取层，射线自动忽略

  return {
    root,
    update(delta: number) {
      material.uniforms.uTime.value += delta
    },
    dispose() {
      geo.dispose()
      material.dispose()
    },
  }
}
