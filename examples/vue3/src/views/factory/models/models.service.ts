/**
 * 工厂模型服务：加载 GLTF、持有 AssetHandle、创建业务实例并管理资源生命周期。
 */

import * as THREE from 'three'
import {
  defineService,
  type GltfAsset,
  type GltfInstance,
} from '@threxus/runtime'

const MODEL_FILES = {
  robotArm: 'assets/models/robot-arm.glb',
  conveyor: 'assets/models/conveyor.glb',
  cabinet: 'assets/models/cabinet.glb',
  agv: 'assets/models/agv.glb',
} as const

export type ModelKey = keyof typeof MODEL_FILES

export interface RobotArmHandle {
  readonly root: THREE.Object3D
  update(elapsed: number): void
}

export interface FactoryModelsApi {
  createRobotArm(phase?: number): RobotArmHandle
  instance(
    key: ModelKey,
    matrices: readonly THREE.Matrix4[],
  ): THREE.InstancedMesh[]
  clone(key: ModelKey): THREE.Object3D
  /** 判断 Geometry 是否属于 AssetManager 管理的 GLTF 共享资源。 */
  isManagedGeometry(geometry: THREE.BufferGeometry): boolean
}

export const FactoryModelsService = defineService<FactoryModelsApi>(
  'factory-models',
  async (context) => {
    const entries = Object.entries(MODEL_FILES) as Array<[ModelKey, string]>
    const loaded = await Promise.all(
      entries.map(async ([key, url]) => {
        const handle = await context.assets.acquireGLTF(url, {
          signal: context.signal,
        })
        const asset = context.mount(handle)
        prepareMaterials(asset.scene)
        console.info(`[FactoryModels] ✓ ${key}  (${url})`)
        return [key, asset] as const
      }),
    )

    const assets = new Map<ModelKey, GltfAsset>(loaded)
    const managedGeometries = collectManagedGeometries(assets.values())
    const instances = new Set<GltfInstance>()
    const instancedMeshes = new Set<THREE.InstancedMesh>()

    const requireAsset = (key: ModelKey): GltfAsset => {
      const asset = assets.get(key)
      if (!asset) {
        throw new Error(`[FactoryModels] Missing loaded model "${key}".`)
      }
      return asset
    }

    const instantiate = (key: ModelKey): GltfInstance => {
      const instance = requireAsset(key).instantiate({
        mode: 'auto',
        materials: 'shared',
      })
      instances.add(instance)
      return instance
    }

    const api: FactoryModelsApi = {
      createRobotArm(phase = Math.random() * Math.PI * 2) {
        const instance = instantiate('robotArm')
        const { root } = instance
        const j1 = root.getObjectByName('J1_Shoulder') ?? null
        const j2 = root.getObjectByName('J2_UpperArm') ?? null
        const j3 = root.getObjectByName('J3_ForeArm') ?? null

        root.traverse((object) => {
          object.castShadow = true
          object.receiveShadow = true
        })

        return {
          root,
          update(elapsed: number) {
            const t = elapsed * 0.85 + phase
            if (j1) j1.rotation.y = Math.sin(t * 0.5) * 1.15
            if (j2) j2.rotation.x = Math.sin(t * 0.7) * 0.42 - 0.28
            if (j3) j3.rotation.x = Math.sin(t * 0.7 + 1.1) * 0.55 + 0.35
          },
        }
      },

      instance(key, matrices) {
        const result = instanceSubtree(requireAsset(key).scene, matrices)
        for (const mesh of result) instancedMeshes.add(mesh)
        return result
      },

      clone(key) {
        const instance = instantiate(key)
        instance.root.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (mesh.isMesh) {
            mesh.castShadow = true
            mesh.receiveShadow = true
          }
        })
        return instance.root
      },

      isManagedGeometry(geometry) {
        return managedGeometries.has(geometry)
      },
    }

    context.addCleanup(() => {
      for (const mesh of instancedMeshes) {
        mesh.removeFromParent()
        mesh.dispose()
      }
      instancedMeshes.clear()

      for (const instance of instances) instance.dispose()
      instances.clear()

      managedGeometries.clear()
      assets.clear()
    })

    return api
  },
)

function collectManagedGeometries(
  assets: Iterable<GltfAsset>,
): Set<THREE.BufferGeometry> {
  const result = new Set<THREE.BufferGeometry>()
  for (const asset of assets) {
    asset.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) result.add(mesh.geometry)
    })
  }
  return result
}

function instanceSubtree(
  template: THREE.Object3D,
  matrices: readonly THREE.Matrix4[],
): THREE.InstancedMesh[] {
  if (matrices.length === 0) return []

  template.updateWorldMatrix(true, true)
  const result: THREE.InstancedMesh[] = []
  const base = new THREE.Matrix4()
  const composed = new THREE.Matrix4()

  template.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return

    const instanced = new THREE.InstancedMesh(
      mesh.geometry,
      mesh.material as THREE.Material,
      matrices.length,
    )
    instanced.name = `${mesh.name}_instanced`
    instanced.castShadow = true
    instanced.receiveShadow = true
    base.copy(mesh.matrixWorld)

    for (let i = 0; i < matrices.length; i++) {
      composed.multiplyMatrices(matrices[i]!, base)
      instanced.setMatrixAt(i, composed)
    }
    instanced.instanceMatrix.needsUpdate = true
    result.push(instanced)
  })

  return result
}

function prepareMaterials(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial
      if (
        standard.emissive &&
        standard.emissive.r + standard.emissive.g + standard.emissive.b > 0.01
      ) {
        standard.toneMapped = false
        standard.emissiveIntensity = 2.4
      }
    }
  })
}
