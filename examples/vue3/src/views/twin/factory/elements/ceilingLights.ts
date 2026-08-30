/**
 * 顶部灯带 */

import * as THREE from 'three';
import type { FactoryWorld } from '../factory.service';

export function buildCeilingLights(world: FactoryWorld): void {
  const { root, bounds } = world;
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x121820,
    emissive: 0xbfd8ff,
    emissiveIntensity: 1.6,
    roughness: 0.4,
    toneMapped: false,
  });
  const seg = new THREE.BoxGeometry(6, 0.18, 0.5);
  const count = 4 * 8;
  const lamps = new THREE.InstancedMesh(seg, lampMat, count);
  lamps.castShadow = false;
  const m = new THREE.Matrix4();
  let i = 0;
  for (let row = -1; row <= 1; row += 2) {
    for (let k = 0; k < 8; k++) {
      m.makeTranslation((k - 3.5) * 8.6, bounds.height - 0.75, row * 7);
      lamps.setMatrixAt(i++, m);
    }
  }
  lamps.instanceMatrix.needsUpdate = true;
  lamps.name = 'CeilingLights';
  root.add(lamps);
}
