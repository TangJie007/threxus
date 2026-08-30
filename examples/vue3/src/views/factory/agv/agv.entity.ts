/**
 * AGV 实体：沿闭合路径巡航，可被点选聚焦。
 */

import * as THREE from 'three';
import { defineEntity } from '@threxus/runtime';
import { mat } from '../materials/Presets';
import { markPickable } from '../lib/pickable';
import type { ModelAssets } from '../factory/models';

export interface AgvEntityProps {
  readonly models: ModelAssets | null;
}

export interface AgvEntityApi {
  readonly pickId: string;
}

const AGV_PATH = new THREE.CatmullRomCurve3(
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

export const AgvEntity = defineEntity<AgvEntityProps, AgvEntityApi>({
  type: 'agv',
  create(context, props) {
    const guideGeo = new THREE.TubeGeometry(AGV_PATH, 220, 0.045, 6, true);
    const guide = new THREE.Mesh(
      guideGeo,
      new THREE.MeshBasicMaterial({
        color: 0x40e0ff,
        transparent: true,
        opacity: 0.35,
      }),
    );
    guide.position.y = 0.03;
    context.own(guide);

    const agv = new THREE.Group();
    const agvModel = props.models?.clone('agv');

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

    const tmp = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    let t = 0;

    return {
      root: agv,
      api: { pickId: 'AGV-01' },
      update({ delta }) {
        t = (t + delta * 0.035) % 1;
        AGV_PATH.getPointAt(t, tmp);
        agv.position.copy(tmp);
        AGV_PATH.getPointAt((t + 0.004) % 1, ahead);
        agv.lookAt(ahead.x, agv.position.y, ahead.z);
      },
    };
  },
});
