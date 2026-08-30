/**
 * 运行时门面：动画循环、状态联动、剖切、FactorySceneService。
 * 须在所有构建 Feature 之后注册。
 */

import type { Material } from 'three';
import type { ThreeFeature } from '@threxus/runtime';
import { mat, statusMaterial } from './lib/materials/Presets';
import { ClipController } from './lib/fx/ElectricFence';
import type { DeviceRecord, DeviceStatus } from './lib/data/devices';
import {
  FactorySceneService,
  FactoryWorldService,
  ModelAssetsService,
  ScanRingReadyService,
  type FactoryRuntime,
  type FactoryWorld,
} from './services';

function createRuntimeFacade(world: FactoryWorld): FactoryRuntime {
  if (!world.scanRing) {
    throw new Error('factory-runtime requires factory-scan-ring to run first.');
  }
  const scanRing = world.scanRing;

  return {
    get root() {
      return world.root;
    },
    get devices() {
      return world.devices;
    },
    get scanRing() {
      return scanRing;
    },
    get clippableMaterials() {
      return world.clippableMaterials;
    },
    applyStatus(device: DeviceRecord, status: DeviceStatus) {
      device.status = status;
      if (device.indicator) {
        device.indicator.material = statusMaterial(status);
      }
      if (device.beacon) {
        device.beacon.visible = status === 'error';
      }
    },
    setFlowEnabled(v: boolean) {
      for (const p of world.pipes) p.flowEnabled = v;
    },
    setFenceAlert(v: boolean) {
      for (const f of world.fences) f.alert = v;
    },
    findDevice(id: string) {
      return world.devices.find((d) => d.id === id);
    },
  };
}

export function createFactoryRuntimeFeature(): ThreeFeature {
  return {
    name: 'factory-runtime',
    dependencies: [
      FactoryWorldService,
      ModelAssetsService,
      ScanRingReadyService,
    ],
    provides: [FactorySceneService],
    setup(context) {
      const world = context.inject(FactoryWorldService);
      const models = context.inject(ModelAssetsService);

      world.clippableMaterials.push(
        mat('floor') as Material,
        mat('steel') as Material,
        mat('machine') as Material,
        mat('plastic') as Material,
        mat('hazard') as Material,
      );

      context.renderer.localClippingEnabled = true;
      context.addCleanup(() => {
        context.renderer.localClippingEnabled = false;
      });

      const clip = new ClipController();
      clip.register(world.clippableMaterials);

      const factory = createRuntimeFacade(world);

      let elapsed = 0;
      context.onUpdate(({ delta }) => {
        elapsed += delta;
        for (let i = 0; i < world.animated.length; i++) {
          world.animated[i](delta, elapsed);
        }
        world.scanRing?.update(delta);
      });

      context.addCleanup(() => {
        world.pipes.forEach((p) => p.dispose());
        world.fences.forEach((f) => f.dispose());
        world.root.traverse((o) => {
          const mesh = o as { geometry?: { dispose(): void } };
          mesh.geometry?.dispose();
        });
        world.root.clear();
        world.devices.length = 0;
        world.animated.length = 0;
        world.pipes.length = 0;
        world.fences.length = 0;
        world.clippableMaterials.length = 0;
      });

      context.provide(FactorySceneService, { factory, models, clip, world });
    },
  };
}
