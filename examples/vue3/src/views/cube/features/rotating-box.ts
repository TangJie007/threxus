import {
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { cubeBoxes, cubeSceneConfig, cubeTextureUrl } from '../config';
import type { CubeLogger } from '../types';

/**
 * 立方体 Feature（M5 场景 + M6 共享贴图）。
 *
 * M6 用法：
 * 1. `acquireTexture` 加载（同 URL 并发会合并成一次请求）
 * 2. `retain(handle)` 把引用绑到 Feature；销毁时自动 release
 * 3. 不要对 handle.value 手动 texture.dispose()——由 AssetManager 负责
 */
export function createRotatingBoxFeature(log: CubeLogger): ThreeFeature {
  return {
    name: 'rotating-box',
    async setup(context) {
      // 故意并发两次 acquire：演示 M6 请求合并（底层只加载一次）
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

      // second 仅用于演示合并；业务上保留一个引用即可
      second.dispose();
      log(`释放多余 Handle 后 refs=${context.assets.inspect().totalRefs}`);

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

      log(`rotating-box 已创建 ${meshes.length} 个贴图立方体`);

      context.onUpdate(({ delta }) => {
        meshes.forEach((mesh, index) => {
          mesh.rotation.y += delta * cubeBoxes[index]!.spinSpeed;
        });
      });
    },
  };
}
