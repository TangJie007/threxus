import type * as THREE from 'three'

export type DeviceStatus = 'ok' | 'warn' | 'error' | 'idle'

export interface DeviceMetrics {
  /** 主轴温度 ℃ */
  temp: number
  /** 转速 rpm */
  speed: number
  /** 负载率 % */
  load: number
  /** 当班产量 */
  output: number
  /** 振动 mm/s */
  vibration: number
}

export interface DeviceRecord {
  id: string
  name: string
  type: string
  line: string
  status: DeviceStatus
  metrics: DeviceMetrics
  /** 场景中的逻辑节点（带 userData.pickId） */
  node: THREE.Object3D
  /** 状态指示灯 Mesh */
  indicator: THREE.Mesh | null
  /** 告警光柱 */
  beacon: THREE.Object3D | null
  /** 设备根节点的世界坐标，用于相机聚焦与标签定位 */
  position: THREE.Vector3
}

// ------------------------------------------------------------------ 种子数据

const LINE_NAMES = ['A 线 · 焊装', 'B 线 · 总装', 'C 线 · 检测']
const DEVICE_TYPES = [
  ['六轴机器人', 'RB'],
  ['伺服压机', 'PR'],
  ['点焊工位', 'WD'],
  ['视觉检测台', 'VI'],
  ['AGV 充电站', 'CH'],
  ['涂胶机', 'GL'],
  ['拧紧轴', 'TT'],
  ['输送分拣', 'CV'],
] as const

const STATUS_TEXT: Record<DeviceStatus, string> = {
  ok: '运行',
  warn: '告警',
  error: '故障',
  idle: '待机',
}

export function statusText(s: DeviceStatus): string {
  return STATUS_TEXT[s]
}

/** 确定性伪随机，保证每次刷新布局与初始数据一致，方便复现问题 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function makeDeviceSeed(
  index: number,
  lineIndex: number,
  rng: () => number,
): Omit<DeviceRecord, 'node' | 'indicator' | 'beacon' | 'position'> {
  const [type, code] = DEVICE_TYPES[index % DEVICE_TYPES.length]
  const r = rng()
  const status: DeviceStatus = r > 0.9 ? 'error' : r > 0.76 ? 'warn' : r > 0.06 ? 'ok' : 'idle'

  return {
    id: `${code}-${String(lineIndex + 1).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`,
    name: `${type} ${lineIndex + 1}-${index + 1}`,
    type,
    line: LINE_NAMES[lineIndex],
    status,
    metrics: {
      temp: +(42 + rng() * 38).toFixed(1),
      speed: Math.round(600 + rng() * 2400),
      load: Math.round(30 + rng() * 65),
      output: Math.round(120 + rng() * 900),
      vibration: +(0.4 + rng() * 4.2).toFixed(2),
    },
  }
}

// ------------------------------------------------------------------ 遥测推送

export type TelemetryHandler = (patch: Array<{ id: string; status?: DeviceStatus; metrics?: Partial<DeviceMetrics> }>) => void

/**
 * 模拟遥测数据源。
 *
 * 工业项目里这一层必须是"可替换"的：
 *  - 开发环境：MockTelemetry（本类）
 *  - 生产环境：WebSocketTelemetry / SSE
 * 只要实现同一个 connect/handle 契约，上层渲染逻辑一行都不用改。
 *
 * 另一个要点：数据推送频率（1s）远低于渲染帧率（60fps）。
 * 绝不能在数据回调里直接改材质 —— 应该只更新内存里的状态，
 * 由渲染循环统一消费。否则 1000 台设备同时推数据时会瞬间掉帧。
 */
/**
 * 遥测源契约。
 * MockTelemetry 与 WebSocketTelemetry 实现同一接口，
 * 上层渲染逻辑依赖抽象而非实现 —— 换数据源时业务代码零改动。
 */
export interface TelemetrySource {
  onData(fn: TelemetryHandler): void
  connect(): void
  disconnect(): void
}

/** 函数式模拟遥测源（开发环境）。 */
export function createMockTelemetry(
  devices: DeviceRecord[],
  intervalMs = 1000,
): TelemetrySource {
  let timer: number | null = null;
  let handler: TelemetryHandler | null = null;

  const push = (): void => {
    if (!handler) return;
    const count = Math.max(1, Math.floor(devices.length * 0.25));
    const patch: Parameters<TelemetryHandler>[0] = [];
    for (let i = 0; i < count; i++) {
      const d = devices[Math.floor(Math.random() * devices.length)];
      const next: Partial<DeviceMetrics> = {
        temp: clamp(d.metrics.temp + (Math.random() - 0.48) * 3.5, 28, 96),
        load: Math.round(
          clamp(d.metrics.load + (Math.random() - 0.5) * 12, 0, 100),
        ),
        speed: Math.round(
          clamp(d.metrics.speed + (Math.random() - 0.5) * 160, 0, 3600),
        ),
        vibration: +clamp(
          d.metrics.vibration + (Math.random() - 0.5) * 0.6,
          0.1,
          9,
        ).toFixed(2),
      };
      if (Math.random() > 0.85) {
        next.output = d.metrics.output + Math.round(Math.random() * 6);
      }

      let status: DeviceStatus | undefined;
      if ((next.temp ?? 0) > 82) status = 'error';
      else if ((next.temp ?? 0) > 68) status = 'warn';
      else if (d.status !== 'idle' && (next.temp ?? 0) < 62) status = 'ok';

      patch.push({ id: d.id, status, metrics: next });
    }
    handler(patch);
  };

  return {
    onData(fn) {
      handler = fn;
    },
    connect() {
      if (timer !== null) return;
      timer = window.setInterval(push, intervalMs);
    },
    disconnect() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
