/**
 * 管廊流动 Feature：独立于 factory-scene，挂到 Factory world.root。
 */

import * as THREE from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { FactoryService, type FactoryWorld } from '../factory/factory.service';
import { mat } from '../factory/materials/Presets';
import { FlowPipe, makePipeCurve } from './FlowPipe';
import { PipeRackService } from './pipes.service';

function buildPipeRack(world: FactoryWorld): FlowPipe[] {
  const pipes: FlowPipe[] = [];
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
    pipes.push(pipe);

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
      pipes.push(drop);
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

  return pipes;
}

export function createPipeRackFeature(): ThreeFeature {
  return {
    name: 'pipe-rack',
    dependencies: [FactoryService],
    provides: [PipeRackService],
    setup(context) {
      const world = context.inject(FactoryService);
      const pipes = buildPipeRack(world);

      context.onUpdate(({ delta }) => {
        for (let i = 0; i < pipes.length; i++) {
          pipes[i].update(delta);
        }
      });

      context.addCleanup(() => {
        for (const pipe of pipes) {
          pipe.removeFromParent();
          pipe.dispose();
        }
        pipes.length = 0;
      });

      context.provide(PipeRackService, {
        pipes,
        setFlowEnabled(enabled) {
          for (const pipe of pipes) {
            pipe.flowEnabled = enabled;
          }
        },
      });
    },
  };
}
