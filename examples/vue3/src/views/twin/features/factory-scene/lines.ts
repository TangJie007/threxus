/**
 * 产线 + 工位（LOD / 指示�?/ 机械臂）+ 输送带流动�? */

import * as THREE from 'three';
import { mat, statusMaterial } from './materials/Presets';
import { AlertBeacon } from './fx/ScanRing';
import { makeDeviceSeed, makeRng, type DeviceRecord } from './devices';
import { markPickable } from './pickable';
import type { FactoryWorld } from './FactorySceneService';

class RobotArm {
  readonly group = new THREE.Group();
  private readonly j1: THREE.Group;
  private readonly j2: THREE.Group;
  private readonly j3: THREE.Group;
  private phase: number;

  constructor(phase = Math.random() * Math.PI * 2) {
    this.phase = phase;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.68, 0.5, 20),
      mat('steel'),
    );
    base.position.y = 0.25;
    base.castShadow = true;
    this.group.add(base);

    this.j1 = new THREE.Group();
    this.j1.position.y = 0.5;
    this.group.add(this.j1);

    const shoulder = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.9, 0.5),
      mat('machine'),
    );
    shoulder.position.y = 0.45;
    shoulder.castShadow = true;
    this.j1.add(shoulder);

    this.j2 = new THREE.Group();
    this.j2.position.y = 0.9;
    this.j1.add(this.j2);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 1.9, 0.34),
      mat('machine'),
    );
    upper.position.y = 0.95;
    upper.castShadow = true;
    this.j2.add(upper);

    this.j3 = new THREE.Group();
    this.j3.position.y = 1.9;
    this.j2.add(this.j3);

    const fore = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 1.5, 0.26),
      mat('machine'),
    );
    fore.position.y = 0.75;
    fore.castShadow = true;
    this.j3.add(fore);

    const tool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.16, 0.42, 12),
      mat('steel'),
    );
    tool.position.y = 1.62;
    this.j3.add(tool);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      mat('emissiveOk'),
    );
    tip.position.y = 1.86;
    this.j3.add(tip);
  }

  update(_delta: number, elapsed: number): void {
    const t = elapsed * 0.85 + this.phase;
    this.j1.rotation.y = Math.sin(t * 0.5) * 1.15;
    this.j2.rotation.x = Math.sin(t * 0.7) * 0.42 - 0.28;
    this.j3.rotation.x = Math.sin(t * 0.7 + 1.1) * 0.55 + 0.35;
  }
}

function buildConveyor(
  world: FactoryWorld,
  z: number,
  lineIndex: number,
): void {
  const len = 58;
  const group = new THREE.Group();
  group.position.set(0, 0, z);

  if (world.models?.has('conveyor')) {
    const MODULE_LEN = 4;
    const count = Math.round(len / MODULE_LEN);
    const list = world.pendingInstances.get('conveyor') ?? [];
    for (let i = 0; i < count; i++) {
      const x = -len / 2 + MODULE_LEN / 2 + i * (len / count);
      list.push(new THREE.Matrix4().makeTranslation(x, 0, z));
    }
    world.pendingInstances.set('conveyor', list);
  } else {
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.18, 1.9),
      mat('rubber'),
    );
    belt.position.y = 1.05;
    belt.castShadow = true;
    belt.receiveShadow = true;
    group.add(belt);

    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.3, 0.12),
        mat('steel'),
      );
      rail.position.set(0, 1.22, s * 1.0);
      rail.castShadow = true;
      group.add(rail);
    }

    const legGeo = new THREE.BoxGeometry(0.16, 1.0, 1.6);
    const legs = new THREE.InstancedMesh(legGeo, mat('steel'), 20);
    legs.castShadow = true;
    const m = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) {
      m.makeTranslation(-len / 2 + 1.5 + i * ((len - 3) / 19), 0.5, 0);
      legs.setMatrixAt(i, m);
    }
    legs.instanceMatrix.needsUpdate = true;
    group.add(legs);

    const rollerGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.85, 10);
    rollerGeo.rotateX(Math.PI / 2);
    const rollers = new THREE.InstancedMesh(rollerGeo, mat('steel'), 40);
    const m2 = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      m2.makeTranslation(-len / 2 + 0.8 + i * ((len - 1.6) / 39), 0.94, 0);
      rollers.setMatrixAt(i, m2);
    }
    rollers.instanceMatrix.needsUpdate = true;
    group.add(rollers);
  }

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
  x: number,
  z: number,
  lineIndex: number,
  stationIndex: number,
  rng: () => number,
): void {
  const seed = makeDeviceSeed(stationIndex, lineIndex, rng);
  const zOff = stationIndex % 2 === 0 ? -3.2 : 3.2;
  const group = new THREE.Group();
  group.position.set(x, 0, z + zOff);
  group.userData.pickId = seed.id;
  group.userData.deviceId = seed.id;

  const useCabinetModel = !!world.models?.has('cabinet');
  if (useCabinetModel) {
    const list = world.pendingInstances.get('cabinet') ?? [];
    list.push(new THREE.Matrix4().makeTranslation(x + 1.75, 0, z + zOff));
    world.pendingInstances.set('cabinet', list);
    const owners = world.pendingInstanceOwners.get('cabinet') ?? [];
    owners.push(seed.id);
    world.pendingInstanceOwners.set('cabinet', owners);
  }

  const lod = new THREE.LOD();
  const high = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.4, 2.0),
    mat('machine'),
  );
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;
  high.add(body);

  if (!useCabinetModel) {
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.8, 1.2),
      mat('plastic'),
    );
    cabinet.position.set(1.75, 0.9, 0);
    cabinet.castShadow = true;
    high.add(cabinet);
  }

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.44),
    mat('glass'),
  );
  screen.position.set(1.755, 1.45, 0);
  screen.rotateY(Math.PI / 2);
  high.add(screen);

  const finGeo = new THREE.BoxGeometry(1.6, 0.05, 0.06);
  const fins = new THREE.InstancedMesh(finGeo, mat('plastic'), 8);
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
    mat('machine'),
  );
  body2.position.y = 1.2;
  mid.add(body2);
  if (!useCabinetModel) {
    const cab2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.8, 1.2),
      mat('plastic'),
    );
    cab2.position.set(1.75, 0.9, 0);
    mid.add(cab2);
  }

  const low = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 2.4, 2.2),
    mat('machine'),
  );
  low.position.y = 1.2;

  lod.addLevel(high, 0);
  lod.addLevel(mid, 38);
  lod.addLevel(low, 68);
  group.add(lod);

  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    statusMaterial(seed.status),
  );
  indicator.position.set(1.75, 2.05, 0);
  group.add(indicator);

  const beacon = new AlertBeacon(7.5, 0.5, 0xff4d5e);
  beacon.position.set(0, 0.05, 0);
  beacon.visible = seed.status === 'error';
  group.add(beacon);

  if (stationIndex % 3 === 0) {
    const armFromModel = world.models?.createRobotArm(stationIndex * 1.7);
    if (armFromModel) {
      armFromModel.root.position.set(-2.0, 0, 0);
      group.add(armFromModel.root);
      world.animated.push((_d, e) => armFromModel.update(e));
    } else {
      const arm = new RobotArm();
      arm.group.position.set(-2.0, 0, 0);
      group.add(arm.group);
      world.animated.push((d, e) => arm.update(d, e));
    }
  }

  markPickable(group);
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

export function buildLines(world: FactoryWorld): void {
  const rng = makeRng(20260829);
  const lineZ = [-16, 0, 16];
  const stationX = [-24, -14.4, -4.8, 4.8, 14.4, 24];

  lineZ.forEach((z, li) => {
    buildConveyor(world, z, li);
    stationX.forEach((x, si) => {
      buildStation(world, x, z, li, si, rng);
    });
  });
}
