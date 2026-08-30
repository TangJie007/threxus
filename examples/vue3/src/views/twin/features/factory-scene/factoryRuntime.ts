/**
 * Runtime facade helper (not a Feature): status / flow / fence API for UI bridge.
 */

import { statusMaterial } from './materials/Presets';
import type { DeviceRecord, DeviceStatus } from './devices';
import type { FactoryRuntime, FactoryWorld } from './FactorySceneService';

export function createRuntimeFacade(world: FactoryWorld): FactoryRuntime {
  if (!world.scanRing) {
    throw new Error('factory-runtime requires scan-ring to be built first.');
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
