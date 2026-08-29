import { clamp } from 'es-toolkit';
import type { PixelRatioOption } from './types';

const DEFAULT_MAX_PIXEL_RATIO = 2;

/** 解析 pixelRatio 配置，device 模式受 max 限制。 */
export function resolvePixelRatio(option: PixelRatioOption | undefined): number {
  if (option === undefined || option === 'device') {
    return resolveDevicePixelRatio(DEFAULT_MAX_PIXEL_RATIO);
  }

  if (typeof option === 'number') {
    return clamp(option, 0.1, 8);
  }

  return resolveDevicePixelRatio(option.max);
}

function resolveDevicePixelRatio(max: number): number {
  const deviceRatio =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return clamp(deviceRatio, 0.1, max);
}
