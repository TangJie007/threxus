import {
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { cubeBoxes, cubeSceneConfig } from '../config';
import type { CubeLogger } from '../types';

export function createRotatingBoxFeature(log: CubeLogger): ThreeFeature {
  return {
    name: 'rotating-box',
    setup(context) {
      // 同类立方体共用一份几何，用 scale 区分大小
      const geometry = new BoxGeometry();
      const materials: MeshStandardMaterial[] = [];
      const meshes: Mesh[] = [];

      for (const box of cubeBoxes) {
        const material = new MeshStandardMaterial({ color: box.color });
        const mesh = new Mesh(geometry, material);

        mesh.position.set(box.position[0], box.position[1], box.position[2]);
        mesh.rotation.set(box.rotation[0], box.rotation[1], box.rotation[2]);
        mesh.scale.setScalar(box.size);

        context.scene.add(mesh);
        context.own(mesh);

        materials.push(material);
        meshes.push(mesh);
      }

      const light = new DirectionalLight(
        cubeSceneConfig.lightColor,
        cubeSceneConfig.lightIntensity,
      );
      light.position.set(...cubeSceneConfig.lightPosition);
      context.scene.add(light);
      context.own(light);

      context.addCleanup(() => geometry.dispose());
      for (const material of materials) {
        context.addCleanup(() => material.dispose());
      }

      log(`rotating-box 已创建 ${meshes.length} 个立方体`);

      context.onUpdate(({ delta }) => {
        meshes.forEach((mesh, index) => {
          mesh.rotation.y += delta * cubeBoxes[index]!.spinSpeed;
        });
      });
    },
  };
}
