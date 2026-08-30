/**
 * AGV 路径巡航。
 */

import * as THREE from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { mat } from './lib/materials/Presets';
import { markPickable } from './lib/scene/pickable';
import {
  FactoryWorldService,
  ModelAssetsService,
  type FactoryWorld,
} from './services';

function buildAGV(world: FactoryWorld): void {
  const path = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-38, 0, 8),
      new THREE.Vector3(-12, 0, 8),
      new THREE.Vector3(12, 0, 8),
      new THREE.Vector3(38, 0, 8),
      new THREE.Vector3(38, 0, 22),
      new THREE.Vector3(0, 0, 24),
      new THREE.Vector3(-38, 0, 22),
    ],
    true,
    'catmullrom',
    0.5,
  );

  const guideGeo = new THREE.TubeGeometry(path, 220, 0.045, 6, true);
  const guide = new THREE.Mesh(
    guideGeo,
    new THREE.MeshBasicMaterial({
      color: 0x40e0ff,
      transparent: true,
      opacity: 0.35,
    }),
  );
  guide.position.y = 0.03;
  world.root.add(guide);

  const agv = new THREE.Group();
  const agvModel = world.models?.clone('agv');

  if (agvModel) {
    agv.add(agvModel);
  } else {
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.45, 1.1),
      mat('machine'),
    );
    chassis.position.y = 0.36;
    chassis.castShadow = true;
    agv.add(chassis);
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 0.9),
      mat('plastic'),
    );
    cargo.position.y = 0.83;
    cargo.castShadow = true;
    agv.add(cargo);
    for (const sx of [-0.5, 0.5]) {
      for (const sz of [-0.42, 0.42]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.14, 12),
          mat('rubber'),
        );
        wheel.rotateZ(Math.PI / 2);
        wheel.position.set(sx, 0.16, sz);
        agv.add(wheel);
      }
    }
    const agvLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 8),
      mat('emissiveOk'),
    );
    agvLight.position.set(0.82, 0.62, 0);
    agv.add(agvLight);
  }

  agv.userData.pickId = 'AGV-01';
  markPickable(agv);
  world.root.add(agv);

  const tmp = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  let t = 0;
  world.animated.push((delta) => {
    t = (t + delta * 0.035) % 1;
    path.getPointAt(t, tmp);
    agv.position.copy(tmp);
    path.getPointAt((t + 0.004) % 1, ahead);
    agv.lookAt(ahead.x, agv.position.y, ahead.z);
  });
}

export function createAgvFeature(): ThreeFeature {
  return {
    name: 'factory-agv',
    dependencies: [FactoryWorldService, ModelAssetsService],
    setup(context) {
      buildAGV(context.inject(FactoryWorldService));
    },
  };
}
