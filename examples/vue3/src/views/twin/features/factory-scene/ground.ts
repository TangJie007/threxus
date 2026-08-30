/**
 * 地面 + 网格 + 安全通道�? */

import * as THREE from 'three';
import { mat } from './materials/Presets';
import { gridLines } from './materials/ProceduralTextures';
import type { FactoryWorld } from './FactorySceneService';

export function buildGround(world: FactoryWorld): void {
  const { root, bounds } = world;

  const floorGeo = new THREE.PlaneGeometry(bounds.width, bounds.depth);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, mat('floor'));
  floor.receiveShadow = true;
  floor.name = 'Ground';
  root.add(floor);

  const gridGeo = new THREE.PlaneGeometry(bounds.width, bounds.depth);
  gridGeo.rotateX(-Math.PI / 2);
  const gridMat = new THREE.MeshBasicMaterial({
    map: gridLines(512, 1),
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    color: 0x40e0ff,
  });
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.position.y = 0.012;
  grid.renderOrder = 1;
  root.add(grid);

  for (const z of [-8, 8]) {
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(bounds.width - 8, 2.2),
      mat('hazard'),
    );
    lane.rotateX(-Math.PI / 2);
    lane.position.set(0, 0.015, z);
    lane.receiveShadow = true;
    root.add(lane);
  }
}
