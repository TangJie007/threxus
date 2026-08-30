/**
 * 厂房钢结构：mergeGeometries 合并为 1 个 Draw Call。
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from '../materials/Presets';
import type { FactoryWorld } from '../factory.service';

export function buildStructure(world: FactoryWorld): void {
  const { root, bounds } = world;
  const parts: THREE.BufferGeometry[] = [];
  const colW = 0.55;
  const spanX = 21;
  const spanZ = 24;

  for (let ix = -2; ix <= 2; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const g = new THREE.BoxGeometry(colW, bounds.height, colW);
      g.translate(ix * spanX, bounds.height / 2, iz * spanZ);
      parts.push(g);
      const base = new THREE.BoxGeometry(colW * 2.2, 0.3, colW * 2.2);
      base.translate(ix * spanX, 0.15, iz * spanZ);
      parts.push(base);
    }
  }

  for (let iz = -1; iz <= 1; iz++) {
    const g = new THREE.BoxGeometry(bounds.width - 6, 0.42, 0.42);
    g.translate(0, bounds.height - 0.3, iz * spanZ);
    parts.push(g);
    for (let i = -6; i <= 6; i++) {
      const d = new THREE.BoxGeometry(0.22, 1.5, 0.22);
      d.translate(i * 7.5, bounds.height - 1.1, iz * spanZ);
      parts.push(d);
    }
  }

  for (let ix = -2; ix <= 2; ix++) {
    const g = new THREE.BoxGeometry(0.36, 0.36, spanZ * 2);
    g.translate(ix * spanX, bounds.height - 0.3, 0);
    parts.push(g);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());

  if (!merged) {
    console.error('[factory-structure] 几何合并失败');
    return;
  }
  merged.computeBoundingSphere();

  const steel = new THREE.Mesh(merged, mat('steel'));
  steel.castShadow = true;
  steel.receiveShadow = true;
  steel.name = 'SteelStructure';
  steel.matrixAutoUpdate = false;
  steel.updateMatrix();
  root.add(steel);
}
