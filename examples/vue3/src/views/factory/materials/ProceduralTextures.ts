/**
 * 程序化贴图工厂（实例化，由 Feature 持有生命周期）。
 *
 * 用途：内网/离线无素材库时的表面细节兜底；同参数缓存一份以省显存。
 */

import * as THREE from 'three'

export interface SurfaceMaps {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
}

export interface ProceduralTexturesApi {
  concrete(size?: number, repeat?: number, seed?: number): SurfaceMaps
  brushedMetal(size?: number, repeat?: number, tint?: string): SurfaceMaps
  hazardStripes(size?: number, repeat?: number): THREE.Texture
  gridLines(size?: number, repeat?: number): THREE.Texture
  radialGlow(size?: number, inner?: string, outer?: string): THREE.Texture
  dispose(): void
}

function makeCanvas(size: number): {
  c: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function toTexture(
  c: HTMLCanvasElement,
  repeat = 1,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = colorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

function hash2(x: number, y: number, seed = 0): number {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = smoothstep(xf)
  const v = smoothstep(yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

function fbm(x: number, y: number, octaves = 5, seed = 0): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 37)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

function heightToNormal(
  height: HTMLCanvasElement,
  strength = 2.0,
): HTMLCanvasElement {
  const size = height.width
  const src = height.getContext('2d')!.getImageData(0, 0, size, size).data
  const { c, ctx } = makeCanvas(size)
  const out = ctx.createImageData(size, size)

  const at = (x: number, y: number): number => {
    const xx = (x + size) % size
    const yy = (y + size) % size
    return src[(yy * size + xx) * 4] / 255
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1)
      const t = at(x, y - 1)
      const tr = at(x + 1, y - 1)
      const l = at(x - 1, y)
      const r = at(x + 1, y)
      const bl = at(x - 1, y + 1)
      const b = at(x, y + 1)
      const br = at(x + 1, y + 1)

      const dx = tl + 2 * l + bl - (tr + 2 * r + br)
      const dy = tl + 2 * t + tr - (bl + 2 * b + br)

      let nx = dx * strength
      let ny = dy * strength
      const nz = 1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len

      const i = (y * size + x) * 4
      out.data[i] = (nx * 0.5 + 0.5) * 255
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255
      out.data[i + 2] = (nz / len) * 0.5 * 255 + 127.5
      out.data[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  return c
}

/** 创建带缓存的程序贴图 API；由 Feature provide 并在 cleanup 时 dispose。 */
export function createProceduralTextures(): ProceduralTexturesApi {
  const cache = new Map<string, unknown>()

  function cached<T>(key: string, fn: () => T): T {
    if (!cache.has(key)) cache.set(key, fn())
    return cache.get(key) as T
  }

  return {
    concrete(size = 512, repeat = 1, seed = 7) {
      return cached(`concrete:${size}:${repeat}:${seed}`, () => {
        const { c, ctx } = makeCanvas(size)
        const img = ctx.createImageData(size, size)
        const { c: hc, ctx: hctx } = makeCanvas(size)
        const himg = hctx.createImageData(size, size)

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const u = (x / size) * 8
            const v = (y / size) * 8
            const grain = fbm(u * 12, v * 12, 4, seed)
            const stain = fbm(u * 1.5, v * 1.5, 4, seed + 99)
            const l = 0.62 + grain * 0.14 - stain * 0.22

            const i = (y * size + x) * 4
            const g = Math.max(0, Math.min(255, l * 255))
            img.data[i] = g * 0.98
            img.data[i + 1] = g * 1.0
            img.data[i + 2] = g * 1.03
            img.data[i + 3] = 255

            const h = Math.max(0, Math.min(255, (grain * 0.6 + stain * 0.4) * 255))
            himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = h
            himg.data[i + 3] = 255
          }
        }
        ctx.putImageData(img, 0, 0)
        hctx.putImageData(himg, 0, 0)

        return {
          map: toTexture(c, repeat),
          normalMap: toTexture(heightToNormal(hc, 1.2), repeat, THREE.NoColorSpace),
          roughnessMap: toTexture(hc, repeat, THREE.NoColorSpace),
        }
      })
    },

    brushedMetal(size = 512, repeat = 1, tint = '#b9c2cc') {
      return cached(`metal:${size}:${repeat}:${tint}`, () => {
        const { c, ctx } = makeCanvas(size)
        const { c: hc, ctx: hctx } = makeCanvas(size)
        const himg = hctx.createImageData(size, size)

        ctx.fillStyle = tint
        ctx.fillRect(0, 0, size, size)

        for (let i = 0; i < 2600; i++) {
          const y = Math.random() * size
          const x = Math.random() * size
          const len = 20 + Math.random() * 180
          const a = 0.02 + Math.random() * 0.06
          ctx.strokeStyle =
            Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
          ctx.lineWidth = 0.6 + Math.random() * 0.9
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + len, y + (Math.random() - 0.5) * 0.8)
          ctx.stroke()
        }

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4
            const streak = valueNoise(x / 3, y * 2.5, 11)
            const h = 128 + (streak - 0.5) * 90
            himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = h
            himg.data[i + 3] = 255
          }
        }
        hctx.putImageData(himg, 0, 0)

        return {
          map: toTexture(c, repeat),
          normalMap: toTexture(heightToNormal(hc, 0.8), repeat, THREE.NoColorSpace),
          roughnessMap: toTexture(hc, repeat, THREE.NoColorSpace),
        }
      })
    },

    hazardStripes(size = 256, repeat = 1) {
      return cached(`hazard:${size}:${repeat}`, () => {
        const { c, ctx } = makeCanvas(size)
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(0, 0, size, size)
        ctx.strokeStyle = '#f0b429'
        ctx.lineWidth = size / 8
        for (let i = -size; i < size * 2; i += size / 4) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i + size, size)
          ctx.stroke()
        }
        return toTexture(c, repeat)
      })
    },

    gridLines(size = 512, repeat = 1) {
      return cached(`grid:${size}:${repeat}`, () => {
        const { c, ctx } = makeCanvas(size)
        ctx.clearRect(0, 0, size, size)
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(0.75, 0.75, size - 1.5, size - 1.5)
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'
        ctx.lineWidth = 1
        for (let i = 1; i < 4; i++) {
          const p = (size / 4) * i
          ctx.beginPath()
          ctx.moveTo(p, 0)
          ctx.lineTo(p, size)
          ctx.moveTo(0, p)
          ctx.lineTo(size, p)
          ctx.stroke()
        }
        return toTexture(c, repeat)
      })
    },

    radialGlow(
      size = 256,
      inner = '#40e0ff',
      outer = 'rgba(64,224,255,0)',
    ) {
      return cached(`glow:${size}:${inner}`, () => {
        const { c, ctx } = makeCanvas(size)
        const g = ctx.createRadialGradient(
          size / 2,
          size / 2,
          0,
          size / 2,
          size / 2,
          size / 2,
        )
        g.addColorStop(0, inner)
        g.addColorStop(
          0.45,
          inner.replace(')', ',0.45)').replace('rgb', 'rgba'),
        )
        g.addColorStop(1, outer)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, size, size)
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        t.needsUpdate = true
        return t
      })
    },

    dispose() {
      cache.forEach((v) => {
        const list =
          v && (v as THREE.Texture).isTexture
            ? [v as THREE.Texture]
            : Object.values(v as object)
        for (const t of list) {
          if (t && (t as THREE.Texture).isTexture) {
            ;(t as THREE.Texture).dispose()
          }
        }
      })
      cache.clear()
    },
  }
}
