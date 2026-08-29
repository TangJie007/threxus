import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { cubeSceneConfig } from '../config';
import type { CubeLogger } from '../types';

export function createRotatingBoxFeature(log: CubeLogger): ThreeFeature {
  return {
    name: 'rotating-box',
    setup(context) {
      const geometry = new BoxGeometry();
      const material = new MeshStandardMaterial({
        color: cubeSceneConfig.boxColor,
      });
      const mesh = new Mesh(geometry, material);
      context.scene.add(mesh);
      context.own(mesh);

      const light = new DirectionalLight(
        cubeSceneConfig.lightColor,
        cubeSceneConfig.lightIntensity,
      );
      light.position.set(...cubeSceneConfig.lightPosition);
      context.scene.add(light);
      context.own(light);

      context.addCleanup(() => geometry.dispose());
      context.addCleanup(() => material.dispose());

      log('rotating-box 已创建 WebGL 场景');

      context.onUpdate(({ delta }) => {
        mesh.rotation.y += delta * cubeSceneConfig.rotationSpeed;
      });
    },
  };
}
