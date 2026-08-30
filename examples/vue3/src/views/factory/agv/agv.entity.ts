/**
 * AGV 实体：沿闭合路径巡航，可被点选聚焦。
 */

import * as THREE from 'three';
import { DEFAULT_PICK_LAYER, defineEntity, markPickable } from '@threxus/runtime';
import type { FactoryModelsApi } from '../models/models.service';

export interface AgvEntityProps {
  readonly models: FactoryModelsApi;
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
    context.mount(guide, { gpu: 'owned' });

    const agv = new THREE.Group();
    agv.add(props.models.clone('agv'));

    markPickable(agv, 'AGV-01', { layer: DEFAULT_PICK_LAYER });

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
