/**
 * Twin 桥接：遥测 / 选中 / 标签 / 工具条 ↔ Vue 状态。
 * 对应 test main.ts 的 dashboard + telemetry + toolbar 接线。
 */

import { Vector3 } from 'three';
import { markRaw } from 'vue';
import type { ThreeFeature } from '@threxus/runtime';
import {
  CameraRigService,
  EffectComposerService,
  LabelsService,
  SelectionService,
  StatsService,
  markPickable,
} from '@threxus/runtime';
import {
  MockTelemetry,
  statusText,
  type DeviceRecord,
  type DeviceStatus,
} from '../lib/data/devices';
import { FactorySceneService } from './factory-scene';
import type { TwinBridge, TwinKpi, TwinToggles } from '../types';

const STATUS_CLASS: Record<DeviceStatus, string> = {
  ok: 's-ok',
  warn: 's-warn',
  error: 's-err',
  idle: 's-idle',
};

function computeKpi(devices: DeviceRecord[]): TwinKpi {
  let run = 0;
  let warn = 0;
  let error = 0;
  let loadSum = 0;
  for (const d of devices) {
    if (d.status === 'ok') run += 1;
    else if (d.status === 'warn') warn += 1;
    else if (d.status === 'error') error += 1;
    loadSum += d.metrics.load;
  }
  const oee =
    devices.length === 0 ? 0 : Math.round(loadSum / devices.length);
  return { run, warn, error, oee };
}

function createLabelElement(device: DeviceRecord): HTMLElement {
  const el = document.createElement('div');
  el.className = `tag ${STATUS_CLASS[device.status]}`;
  el.innerHTML = `<i class="led"></i><span>${device.name}</span>`;
  el.title = `${device.id} · ${statusText(device.status)}`;
  return el;
}

export function createTwinBridgeFeature(bridge: TwinBridge): ThreeFeature {
  return {
    name: 'twin-bridge',
    dependencies: [
      FactorySceneService,
      SelectionService,
      EffectComposerService,
      LabelsService,
      CameraRigService,
      StatsService,
    ],
    setup(context) {
      const { factory, clip } = context.inject(FactorySceneService);
      const selection = context.inject(SelectionService);
      const composer = context.inject(EffectComposerService);
      const labels = context.inject(LabelsService);
      const cameraRig = context.inject(CameraRigService);
      const stats = context.inject(StatsService);

      // 确保设备逻辑根可被 Input pickId 解析（Factory 已写 userData.pickId）
      for (const d of factory.devices) {
        markPickable(d.node, d.id);
      }
      let agvNode: import('three').Object3D | null = null;
      factory.root.traverse((o) => {
        if (o.userData.pickId === 'AGV-01') agvNode = o;
      });
      if (agvNode) {
        markPickable(agvNode, 'AGV-01');
      }

      const toggles: TwinToggles = {
        outline: true,
        bloom: true,
        ao: true,
        flow: true,
        fence: false,
        clip: false,
        labels: true,
      };

      bridge.factory = markRaw(factory);
      bridge.clip = markRaw(clip);
      bridge.selection = markRaw(selection);
      bridge.composer = markRaw(composer);
      bridge.labels = markRaw(labels);
      bridge.cameraRig = markRaw(cameraRig);
      bridge.stats = markRaw(stats);
      bridge.devices = factory.devices;
      bridge.toggles = { ...toggles };
      bridge.kpi = computeKpi(factory.devices);
      bridge.cameraMode = cameraRig.mode;
      bridge.selectedId = null;

      const syncLabels = (): void => {
        labels.setAll(
          factory.devices.map((d) => ({
            id: d.id,
            anchor: d.node,
            element: createLabelElement(d),
            offset: [0, 2.4, 0] as const,
          })),
        );
        labels.setVisible(toggles.labels);
      };
      syncLabels();

      const focusDevice = (id: string): void => {
        const d = factory.findDevice(id);
        if (!d) {
          if (id === 'AGV-01' && agvNode) {
            cameraRig.flyTo(agvNode.getWorldPosition(new Vector3()), {
              distance: 10,
              height: 6,
            });
          }
          return;
        }
        bridge.selectedId = id;
        selection.clear();
        selection.select(d.node);
        cameraRig.flyTo(d.position.clone().setY(1.6), {
          distance: 11,
          height: 7,
        });
        factory.scanRing.focusAt(d.position.x, d.position.z);
        context.invalidate();
      };

      const clearSelection = (): void => {
        bridge.selectedId = null;
        selection.clear();
        context.invalidate();
      };

      const setCameraMode = (mode: 'orbit' | 'roam'): void => {
        cameraRig.setMode(mode);
        bridge.cameraMode = cameraRig.mode;
      };

      const setToggle = (key: keyof TwinToggles, value: boolean): void => {
        toggles[key] = value;
        bridge.toggles = { ...toggles };
        switch (key) {
          case 'outline':
            composer.setPassEnabled('outline', value);
            break;
          case 'bloom':
            composer.setPassEnabled('bloom', value);
            break;
          case 'ao':
            composer.setPassEnabled('gtao', value);
            break;
          case 'flow':
            factory.setFlowEnabled(value);
            break;
          case 'fence':
            factory.setFenceAlert(value);
            break;
          case 'clip':
            clip.setEnabled(value);
            break;
          case 'labels':
            labels.setVisible(value);
            break;
        }
        context.invalidate();
      };

      const hoverPreview = (id: string | null): void => {
        if (bridge.selectedId) return;
        const d = id ? factory.findDevice(id) : undefined;
        composer.setOutlineSelected(d ? [d.node] : []);
        context.invalidate();
      };

      bridge.focusDevice = focusDevice;
      bridge.clearSelection = clearSelection;
      bridge.setCameraMode = setCameraMode;
      bridge.setToggle = setToggle;
      bridge.hoverPreview = hoverPreview;

      context.addCleanup(
        selection.onChange((selected) => {
          const first = selected[0];
          const id =
            (first?.userData.pickId as string | undefined) ?? null;
          if (id && id !== bridge.selectedId) {
            const d = factory.findDevice(id);
            if (d) {
              bridge.selectedId = id;
              cameraRig.flyTo(d.position.clone().setY(1.6), {
                distance: 11,
                height: 7,
              });
              factory.scanRing.focusAt(d.position.x, d.position.z);
            } else {
              bridge.selectedId = id;
            }
          } else if (!id) {
            bridge.selectedId = null;
          }
        }),
      );

      const telemetry = new MockTelemetry(factory.devices, 900);
      telemetry.onData((patch) => {
        for (const p of patch) {
          const d = factory.findDevice(p.id);
          if (!d) continue;
          if (p.metrics) Object.assign(d.metrics, p.metrics);
          if (p.status && p.status !== d.status) {
            factory.applyStatus(d, p.status);
          }
        }
        bridge.devices = [...factory.devices];
        bridge.kpi = computeKpi(factory.devices);
        syncLabels();
        context.invalidate();
      });
      telemetry.connect();
      context.addCleanup(() => telemetry.disconnect());

      let statsAccum = 0;
      context.onUpdate(({ delta }) => {
        statsAccum += delta;
        if (statsAccum >= 0.25) {
          statsAccum = 0;
          bridge.latestStats = stats.latest;
        }
        if (bridge.cameraMode !== cameraRig.mode) {
          bridge.cameraMode = cameraRig.mode;
        }
      });

      const onKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') clearSelection();
        if (e.key === 'r' || e.key === 'R') {
          setCameraMode(cameraRig.mode === 'roam' ? 'orbit' : 'roam');
        }
      };
      window.addEventListener('keydown', onKey);
      context.addCleanup(() => window.removeEventListener('keydown', onKey));

      bridge.ready = true;
    },
  };
}
