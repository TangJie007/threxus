import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { cubeBoxes, cubeTextureUrl } from '../config';
import type { CubeLogger } from '../types';

/**
 * 立方体 Feature（M6 共享贴图 + M8 Pointer 交互）。
 *
 * 灯光由 environmentFeature 提供。
 */
export function createRotatingBoxFeature(log: CubeLogger): ThreeFeature {
  return {
    name: 'rotating-box',
    async setup(context) {
      const [first, second] = await Promise.all([
        context.assets.acquireTexture(cubeTextureUrl, {
          signal: context.signal,
          loaderOptions: { colorSpace: SRGBColorSpace },
        }),
        context.assets.acquireTexture(cubeTextureUrl, {
          signal: context.signal,
          loaderOptions: { colorSpace: SRGBColorSpace },
        }),
      ]);

      context.retain(first);
      context.retain(second);

      const shared = first.value === second.value;
      log(
        `M6 acquireTexture ×2：${shared ? '共享同一 Texture' : '未共享'}，refs=${context.assets.inspect().totalRefs}`,
      );

      second.dispose();
      log(`M6 释放多余 Handle 后 refs=${context.assets.inspect().totalRefs}`);

      const texture = first.value;
      const geometry = new BoxGeometry();
      const materials: MeshStandardMaterial[] = [];
      const meshes: Mesh[] = [];

      for (const box of cubeBoxes) {
        const material = new MeshStandardMaterial({
          color: box.color,
          map: texture,
        });
        const mesh = new Mesh(geometry, material);

        mesh.position.set(box.position[0], box.position[1], box.position[2]);
        mesh.rotation.set(box.rotation[0], box.rotation[1], box.rotation[2]);
        mesh.scale.setScalar(box.size);

        context.scene.add(mesh);
        context.own(mesh);

        materials.push(material);
        meshes.push(mesh);
      }

      context.addCleanup(() => geometry.dispose());
      for (const material of materials) {
        context.addCleanup(() => material.dispose());
      }

      log(`M6 rotating-box：${meshes.length} 个贴图立方体`);

      for (const [index, mesh] of meshes.entries()) {
        mesh.name = `cube-box-${index}`;
        context.input.on(mesh, 'pointerenter', () => {
          mesh.scale.setScalar(cubeBoxes[index]!.size * 1.08);
          context.invalidate();
        });
        context.input.on(mesh, 'pointerleave', () => {
          mesh.scale.setScalar(cubeBoxes[index]!.size);
          context.invalidate();
        });
        context.input.on(mesh, 'click', () => {
          log(`M8 click：${mesh.name}`);
        });
      }

      context.onUpdate(({ delta }) => {
        meshes.forEach((mesh, index) => {
          mesh.rotation.y += delta * cubeBoxes[index]!.spinSpeed;
        });
      });
    },
  };
}
