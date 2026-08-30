/**
 * 管廊流动特效�? */

import * as THREE from 'three';
import { mat } from './materials/Presets';
import { FlowPipe, makePipeCurve } from './fx/FlowPipe';
import type { FactoryWorld } from './FactorySceneService';

export function buildPipeRack(world: FactoryWorld): void {
  const colors = [0x40e0ff, 0x2ee6a8, 0xffb020];
  const zs = [-8, 8];

  zs.forEach((z, i) => {
    const curve = makePipeCurve([
      [-46, 8.4, z],
      [-20, 8.0, z + (i === 0 ? 1.2 : -1.2)],
      [0, 8.6, z],
      [20, 8.0, z + (i === 0 ? -1.2 : 1.2)],
      [46, 8.4, z],
    ]);
    const pipe = new FlowPipe({
      curve,
      radius: 0.16,
      color: colors[i % colors.length],
      speed: 0.28 + i * 0.1,
      dashCount: 26,
    });
    pipe.name = `Pipe-${i}`;
    world.root.add(pipe);
    world.pipes.push(pipe);
    world.animated.push((d) => pipe.update(d));

    for (const sx of [-24, 0, 24]) {
      const drop = new FlowPipe({
        curve: makePipeCurve([
          [sx, 8.3, z],
          [sx, 5.0, z],
          [sx, 2.2, z + 0.8],
          [sx, 1.6, z + 1.6],
        ]),
        radius: 0.1,
        color: colors[i % colors.length],
        speed: 0.4,
        dashCount: 8,
      });
      world.root.add(drop);
      world.pipes.push(drop);
      world.animated.push((d) => drop.update(d));
    }
  });

  const bracketGeo = new THREE.BoxGeometry(0.14, 1.2, 0.14);
  const brackets = new THREE.InstancedMesh(bracketGeo, mat('steel'), 24);
  const m = new THREE.Matrix4();
  let k = 0;
  for (const z of zs) {
    for (let i = 0; i < 12; i++) {
      m.makeTranslation(-44 + i * 8, 7.6, z);
      brackets.setMatrixAt(k++, m);
    }
  }
  brackets.instanceMatrix.needsUpdate = true;
  brackets.castShadow = true;
  world.root.add(brackets);
}
