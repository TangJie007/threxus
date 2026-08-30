/**
 * 产线 + 工位（LOD / 指示灯 / 机械臂）+ 输送带流动。
 */

import * as THREE from 'three';
import { AlertBeacon } from './scan-ring'
import { makeDeviceSeed, makeRng, type DeviceRecord } from '../../data/devices';
import { DEFAULT_PICK_LAYER, markPickable } from '@threxus/runtime';
import type { FactoryModelsApi } from '../../models/models.service';
import type { FactoryWorld } from '../types';

function buildConveyor(
  world: FactoryWorld,
  z: number,
  lineIndex: number,
): void {
  const len = 58;
  const group = new THREE.Group();
  group.position.set(0, 0, z);

  const moduleLength = 4;
  const count = Math.round(len / moduleLength);
  const list = world.pendingInstances.get('conveyor') ?? [];
  for (let i = 0; i < count; i++) {
    const x = -len / 2 + moduleLength / 2 + i * (len / count);
    list.push(new THREE.Matrix4().makeTranslation(x, 0, z));
  }
  world.pendingInstances.set('conveyor', list);

  const flowGeo = new THREE.PlaneGeometry(len, 1.5);
  flowGeo.rotateX(-Math.PI / 2);
  const flowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x40e0ff) },
      uSpeed: { value: 0.25 + lineIndex * 0.06 },
      uCount: { value: 22 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform float uTime, uSpeed, uCount; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float t = fract(vUv.x * uCount - uTime * uSpeed);
        float band = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.08, 0.30, t));
        float across = 1.0 - smoothstep(0.25, 0.5, abs(vUv.y - 0.5));
        float a = band * across * 0.9;
        if(a < 0.01) discard;
        gl_FragColor = vec4(uColor * 1.8, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const flow = new THREE.Mesh(flowGeo, flowMat);
  flow.position.y = 1.16;
  group.add(flow);
  world.animated.push((d) => {
    flowMat.uniforms.uTime.value += d;
  });

  world.root.add(group);
}

function buildStation(
  world: FactoryWorld,
  models: FactoryModelsApi,
  x: number,
  z: number,
  lineIndex: number,
  stationIndex: number,
  rng: () => number,
): void {
  const { materials } = world;
  const seed = makeDeviceSeed(stationIndex, lineIndex, rng);
  const zOff = stationIndex % 2 === 0 ? -3.2 : 3.2;
  const group = new THREE.Group();
  group.position.set(x, 0, z + zOff);
  group.userData.deviceId = seed.id;

  const cabinets = world.pendingInstances.get('cabinet') ?? [];
  cabinets.push(new THREE.Matrix4().makeTranslation(x + 1.75, 0, z + zOff));
  world.pendingInstances.set('cabinet', cabinets);
  const cabinetOwners = world.pendingInstanceOwners.get('cabinet') ?? [];
  cabinetOwners.push(seed.id);
  world.pendingInstanceOwners.set('cabinet', cabinetOwners);

  const lod = new THREE.LOD();
  const high = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.4, 2.0),
    materials.machine,
  );
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;
  high.add(body);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.44),
    materials.glass,
  );
  screen.position.set(1.755, 1.45, 0);
  screen.rotateY(Math.PI / 2);
  high.add(screen);

  const finGeo = new THREE.BoxGeometry(1.6, 0.05, 0.06);
  const fins = new THREE.InstancedMesh(finGeo, materials.plastic, 8);
  const mf = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) {
    mf.makeTranslation(-0.3, 1.7 + i * 0.07, 1.02);
    fins.setMatrixAt(i, mf);
  }
  fins.instanceMatrix.needsUpdate = true;
  high.add(fins);

  const mid = new THREE.Group();
  const body2 = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.4, 2.0),
    materials.machine,
  );
  body2.position.y = 1.2;
  mid.add(body2);

  const low = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.4, 2.2),
    materials.machine,
  );
  low.position.y = 1.2;

  lod.addLevel(high, 0);
  lod.addLevel(mid, 38);
  lod.addLevel(low, 68);
  group.add(lod);

  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    world.materials.statusMaterial(seed.status),
  );
  indicator.position.set(1.75, 2.05, 0);
  group.add(indicator);

  const beacon = new AlertBeacon(7.5, 0.5, 0xff4d5e)
  beacon.position.set(0, 0.05, 0)
  beacon.visible = seed.status === 'error'
  group.add(beacon)
  world.animated.push((d) => beacon.update(d))

  if (stationIndex % 3 === 0) {
    const arm = models.createRobotArm(stationIndex * 1.7);
    arm.root.position.set(-2.0, 0, 0);
    group.add(arm.root);
    world.animated.push((_d, e) => arm.update(e));
  }

  markPickable(group, seed.id, { layer: DEFAULT_PICK_LAYER });
  world.root.add(group);

  const record: DeviceRecord = {
    ...seed,
    node: group,
    indicator,
    beacon,
    position: new THREE.Vector3(x, 0, z),
  };
  world.devices.push(record);
}

export function buildLines(
  world: FactoryWorld,
  models: FactoryModelsApi,
): void {
  const rng = makeRng(20260829);
  const lineZ = [-16, 0, 16];
  const stationX = [-24, -14.4, -4.8, 4.8, 14.4, 24];

  lineZ.forEach((z, li) => {
    buildConveyor(world, z, li);
    stationX.forEach((x, si) => {
      buildStation(world, models, x, z, li, si, rng);
    });
  });
}
