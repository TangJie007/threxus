import { Group, Mesh, type Object3D } from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { cubeGltfInstances, cubeGltfUrl } from '../config';
import type { CubeLogger } from '../types';

/**
 * M7：acquireGLTF + instantiate。
 *
 * - 同一 GLTF 资产只加载一次
 * - 多个实例挂到不同父节点，默认共享 Geometry / Material
 * - ctx.retain(handle) + ctx.addCleanup(instance) 分管资产与实例生命周期
 * - 灯光由 environmentFeature 提供
 */
export function createGltfBoxesFeature(log: CubeLogger): ThreeFeature {
  return {
    name: 'gltf-boxes',
    async setup(context) {
      const handle = await context.assets.acquireGLTF(cubeGltfUrl, {
        signal: context.signal,
      });
      context.retain(handle);

      const root = new Group();
      root.name = 'gltf-boxes-root';
      context.scene.add(root);
      context.own(root);

      const instances = cubeGltfInstances.map((item, index) => {
        const instance = handle.value.instantiate({
          mode: 'clone',
          materials: 'shared',
        });
        instance.root.position.set(
          item.position[0],
          item.position[1],
          item.position[2],
        );
        instance.root.scale.setScalar(item.scale);
        instance.root.rotation.set(
          item.rotation[0],
          item.rotation[1],
          item.rotation[2],
        );
        root.add(instance.root);
        context.addCleanup(instance);
        log(
          `M7 instantiate #${index + 1} @ (${item.position.join(', ')})`,
        );
        return instance;
      });

      const firstMesh = findFirstMesh(instances[0]?.root);
      const secondMesh = findFirstMesh(instances[1]?.root);
      const sharedGeometry =
        firstMesh !== undefined &&
        secondMesh !== undefined &&
        firstMesh.geometry === secondMesh.geometry;

      log(
        `M7 acquireGLTF：${instances.length} 个实例，Geometry ${sharedGeometry ? '共享' : '未共享'}，refs=${context.assets.inspect().totalRefs}`,
      );

      context.onUpdate(({ delta }) => {
        instances.forEach((instance, index) => {
          const speed = cubeGltfInstances[index]?.spinSpeed ?? 1;
          instance.root.rotation.y += delta * speed;
        });
      });
    },
  };
}

function findFirstMesh(root: Object3D | undefined): Mesh | undefined {
  if (!root) {
    return undefined;
  }
  let found: Mesh | undefined;
  root.traverse((object) => {
    if (!found && object instanceof Mesh) {
      found = object;
    }
  });
  return found;
}
