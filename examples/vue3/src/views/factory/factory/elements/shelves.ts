/**
 * 货架 InstancedMesh。
 */

import * as THREE from 'three';
import { makeRng } from '../../data/devices';
import type { FactoryWorld } from '../types';

export function buildShelves(world: FactoryWorld): void {
  const { materials } = world;
  const postGeo = new THREE.BoxGeometry(0.14, 6, 0.14);
  const posts = new THREE.InstancedMesh(postGeo, materials.steel, 4 * 6);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let rack = 0; rack < 6; rack++) {
    const rx = -40 + rack * 8;
    for (const [ox, oz] of [
      [-1.4, -0.6],
      [1.4, -0.6],
      [-1.4, 0.6],
      [1.4, 0.6],
    ]) {
      m.makeTranslation(rx + ox, 3, -30 + oz);
      posts.setMatrixAt(i++, m);
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  world.root.add(posts);

  const boxGeo = new THREE.BoxGeometry(1.2, 0.9, 1.0);
  const boxes = new THREE.InstancedMesh(boxGeo, materials.plastic, 54);
  const rng = makeRng(4242);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let rack = 0; rack < 6; rack++) {
    for (let level = 0; level < 3; level++) {
      for (let b = 0; b < 3; b++) {
        dummy.position.set(
          -40 + rack * 8 + (b - 1) * 1.35,
          0.75 + level * 1.7,
          -30,
        );
        dummy.rotation.y = (rng() - 0.5) * 0.12;
        dummy.scale.setScalar(0.9 + rng() * 0.2);
        dummy.updateMatrix();
        boxes.setMatrixAt(n, dummy.matrix);
        const c = new THREE.Color().setHSL(
          0.55 + rng() * 0.12,
          0.25,
          0.28 + rng() * 0.12,
        );
        boxes.setColorAt(n, c);
        n++;
      }
    }
  }
  boxes.instanceMatrix.needsUpdate = true;
  if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
  boxes.castShadow = true;
  boxes.receiveShadow = true;
  world.root.add(boxes);
}
