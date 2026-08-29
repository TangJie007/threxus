/**
 * Highlight Feature：依赖 SelectionService，通过 emissive 高亮选中对象。
 */

import type { Material, Mesh, Object3D } from 'three';
import type { ThreeFeature } from '../../feature/ThreeFeature';
import { SelectionService } from '../selection/SelectionService';

export interface HighlightFeatureOptions {
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
}

interface StoredMaterialState {
  readonly material: Material & {
    emissive?: { setHex: (hex: number) => void; getHex: () => number };
    emissiveIntensity?: number;
  };
  readonly emissive: number;
  readonly emissiveIntensity: number;
}

function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) {
      meshes.push(object as Mesh);
    }
  });
  return meshes;
}

export function highlightFeature(
  options: HighlightFeatureOptions = {},
): ThreeFeature {
  const emissive = options.emissive ?? 0x3366ff;
  const emissiveIntensity = options.emissiveIntensity ?? 0.6;

  return {
    name: 'highlight',
    dependencies: [SelectionService],
    setup(context) {
      const selection = context.inject(SelectionService);
      const restored = new Map<Object3D, StoredMaterialState[]>();

      const clearHighlight = (): void => {
        for (const [object, states] of restored) {
          for (const state of states) {
            state.material.emissive?.setHex(state.emissive);
            if (state.material.emissiveIntensity !== undefined) {
              state.material.emissiveIntensity = state.emissiveIntensity;
            }
          }
          restored.delete(object);
        }
      };

      const applyHighlight = (objects: readonly Object3D[]): void => {
        clearHighlight();
        for (const object of objects) {
          const states: StoredMaterialState[] = [];
          for (const mesh of collectMeshes(object)) {
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            for (const material of materials) {
              const mat = material as StoredMaterialState['material'];
              if (!mat.emissive) {
                continue;
              }
              states.push({
                material: mat,
                emissive:
                  typeof mat.emissive.getHex === 'function'
                    ? mat.emissive.getHex()
                    : 0,
                emissiveIntensity: mat.emissiveIntensity ?? 1,
              });
              mat.emissive.setHex(emissive);
              mat.emissiveIntensity = emissiveIntensity;
            }
          }
          if (states.length > 0) {
            restored.set(object, states);
          }
        }
        context.invalidate();
      };

      const subscription = selection.onChange(applyHighlight);
      context.addCleanup(subscription);
      context.addCleanup(() => {
        clearHighlight();
      });
    },
  };
}
