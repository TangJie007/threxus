/**
 * 程序化贴图工厂（自 examples/test 迁入）。
 *
 * 为什么工业项目必须有这一层？
 *  - 内网/离线部署拿不到素材库，却依然要出效果；
 *  - 每块地砖、每台机柜都用同一张 4K 贴图，显存直接爆炸；
 *  - 参数化生成可以按设备尺寸自动调整纹理密度，不会出现拉伸。
 *
 * 所有函数返回 CanvasTexture，并在内部缓存 —— 同样参数只生成一次。
 */

import * as THREE from 'three';

const cache = new Map<string, unknown>();

function makeCanvas(size: number): {
  c: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function toTexture(
  c: HTMLCanvasElement,
  repeat = 1,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = colorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** 缓存任意生成结果（贴图单张、或 { map/normalMap/roughnessMap } 组合） */
function cached<T>(key: string, fn: () => T): T {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as T;
}

// ---------------------------------------------------------------- 噪声

/** 确定性 hash 噪声（同一 seed 永远同一结果，便于复现问题） */
function hash2(x: number, y: number, seed = 0): number {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 双线性插值 value noise */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** 分形叠加噪声，工业表面（水泥、锈迹、塑料）的基础 */
function fbm(x: number, y: number, octaves = 5, seed = 0): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 37);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- 高度图 → 法线图

/**
 * Sobel 算子从灰度高度图生成切线空间法线贴图。
 * 没有法线图，水泥地再怎么打光也是一块死板的塑料板。
 */
export function heightToNormal(
  height: HTMLCanvasElement,
  strength = 2.0,
): HTMLCanvasElement {
  const size = height.width;
  const src = height.getContext('2d')!.getImageData(0, 0, size, size).data;
  const { c, ctx } = makeCanvas(size);
  const out = ctx.createImageData(size, size);

  const at = (x: number, y: number): number => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4]! / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1);
      const t = at(x, y - 1);
      const tr = at(x + 1, y - 1);
      const l = at(x - 1, y);
      const r = at(x + 1, y);
      const bl = at(x - 1, y + 1);
      const b = at(x, y + 1);
      const br = at(x + 1, y + 1);

      const dx = tl + 2 * l + bl - (tr + 2 * r + br);
      const dy = tl + 2 * t + tr - (bl + 2 * b + br);

      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;

      const i = (y * size + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz / len) * 0.5 * 255 + 127.5;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

// ---------------------------------------------------------------- 具体贴图

export interface SurfaceMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/** 工业水泥地/环氧地坪：细颗粒 + 大块污渍 */
export function concrete(size = 512, repeat = 1, seed = 7): SurfaceMaps {
  return cached(`concrete:${size}:${repeat}:${seed}`, () => {
    const { c, ctx } = makeCanvas(size);
    const img = ctx.createImageData(size, size);
    const { c: hc, ctx: hctx } = makeCanvas(size);
    const himg = hctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * 8;
        const v = (y / size) * 8;
        const grain = fbm(u * 12, v * 12, 4, seed);
        const stain = fbm(u * 1.5, v * 1.5, 4, seed + 99);
        const l = 0.62 + grain * 0.14 - stain * 0.22;

        const i = (y * size + x) * 4;
        const g = Math.max(0, Math.min(255, l * 255));
        img.data[i] = g * 0.98;
        img.data[i + 1] = g * 1.0;
        img.data[i + 2] = g * 1.03;
        img.data[i + 3] = 255;

        const h = Math.max(0, Math.min(255, (grain * 0.6 + stain * 0.4) * 255));
        himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = h;
        himg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    hctx.putImageData(himg, 0, 0);

    return {
      map: toTexture(c, repeat),
      normalMap: toTexture(heightToNormal(hc, 1.2), repeat, THREE.NoColorSpace),
      roughnessMap: toTexture(hc, repeat, THREE.NoColorSpace),
    };
  });
}

/** 拉丝金属：水平细纹 + 轻微氧化斑 */
export function brushedMetal(
  size = 512,
  repeat = 1,
  tint = '#b9c2cc',
): SurfaceMaps {
  return cached(`metal:${size}:${repeat}:${tint}`, () => {
    const { c, ctx } = makeCanvas(size);
    const { c: hc, ctx: hctx } = makeCanvas(size);
    const himg = hctx.createImageData(size, size);

    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * size;
      const x = Math.random() * size;
      const len = 20 + Math.random() * 180;
      const a = 0.02 + Math.random() * 0.06;
      ctx.strokeStyle =
        Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.lineWidth = 0.6 + Math.random() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (Math.random() - 0.5) * 0.8);
      ctx.stroke();
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const streak = valueNoise(x / 3, y * 2.5, 11);
        const h = 128 + (streak - 0.5) * 90;
        himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = h;
        himg.data[i + 3] = 255;
      }
    }
    hctx.putImageData(himg, 0, 0);

    return {
      map: toTexture(c, repeat),
      normalMap: toTexture(heightToNormal(hc, 0.8), repeat, THREE.NoColorSpace),
      roughnessMap: toTexture(hc, repeat, THREE.NoColorSpace),
    };
  });
}

/** 警示条纹（黄黑斜条）：安全通道、危险区域地面标识 */
export function hazardStripes(size = 256, repeat = 1): THREE.Texture {
  return cached(`hazard:${size}:${repeat}`, () => {
    const { c, ctx } = makeCanvas(size);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#f0b429';
    ctx.lineWidth = size / 8;
    for (let i = -size; i < size * 2; i += size / 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
    return toTexture(c, repeat);
  });
}

export function disposeProcedural(): void {
  cache.forEach((v) => {
    const list =
      v && (v as THREE.Texture).isTexture
        ? [v as THREE.Texture]
        : Object.values(v as object);
    for (const t of list) {
      if (t && (t as THREE.Texture).isTexture) (t as THREE.Texture).dispose();
    }
  });
  cache.clear();
}
