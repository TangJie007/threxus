#!/usr/bin/env node
/**
 * 素材优化流水线。
 *
 * 把「去哪找来的原始模型」变成「能上线的工业资产」：
 *   原始 glb → 减面 → 合并同材质 → 纹理压缩 → 几何压缩 → 结构体检
 *
 * 用法：
 *   node scripts/optimize-assets.mjs <input.glb> [--out output.glb] [--ratio 0.6] [--texture 1024] [--geo meshopt]
 *
 * 依赖按需通过 npx 拉取，不污染项目依赖。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import { dirname, resolve, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const args = { input: null, out: null, ratio: 0.6, texture: 1024, geo: 'draco' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') args.out = argv[++i]
    else if (a === '--ratio') args.ratio = Number(argv[++i])
    else if (a === '--texture') args.texture = Number(argv[++i])
    else if (a === '--geo') args.geo = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
    else if (!args.input) args.input = a
  }
  return args
}

const args = parseArgs(process.argv)

if (args.help || !args.input) {
  console.log(`
素材优化流水线

  node scripts/optimize-assets.mjs <input.glb> [options]

选项:
  --out <path>      输出路径，默认 <input>.optimized.glb
  --ratio <0-1>     保留面数比例，默认 0.6
  --texture <px>    贴图最长边，默认 1024
  --geo <type>      几何压缩: draco(默认, 体积小) | meshopt(解压快 10 倍)
  -h, --help        显示帮助

示例:
  node scripts/optimize-assets.mjs models/raw/robot.glb --out public/assets/models/robot.glb --ratio 0.5
`)
  process.exit(args.help ? 0 : 1)
}

const input = resolve(process.cwd(), args.input)
if (!existsSync(input)) {
  console.error(`✗ 输入文件不存在: ${input}`)
  process.exit(1)
}

const output = args.out
  ? resolve(process.cwd(), args.out)
  : input.replace(/\.(glb|gltf)$/i, '.optimized.glb')

mkdirSync(dirname(output), { recursive: true })
const before = statSync(input).size

function fmt(bytes) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`
}

/** 用 npx 拉起工具（首次会下载，之后走缓存） */
function runNpx(pkg, cmdArgs, label) {
  console.log(`\n▸ ${label} ...`)
  const r = spawnSync('npx', ['--yes', pkg, ...cmdArgs], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: ROOT,
  })
  if (r.status !== 0) {
    console.error(`✗ ${label} 失败（exit ${r.status}）`)
    return false
  }
  return true
}

// ---------------------------------------------------------------- 流程

console.log(`输入: ${basename(input)}  (${fmt(before)})`)
console.log(`输出: ${output}`)
console.log(`参数: 面数保留 ${(args.ratio * 100).toFixed(0)}%  贴图 ${args.texture}px  几何压缩 ${args.geo}`)

// 第一步：gltfpack —— 减面 + 合并同材质 + 纹理转 KTX2
// -cc 合并同材质的 mesh，这步对降低 Draw Call 的效果最显著
const packArgs = [
  '-i', input,
  '-o', output,
  '-cc',      // 合并同材质网格 → 大幅降 Draw Call
  '-kn', '-km', // 保留节点名与材质名，方便代码里按名查找
  '-si', String(args.ratio), // 简化到指定面数比例
  '-tc',      // 纹理转 KTX2
  '-tcq', '8', // KTX2 质量（工业场景 8 已足够，越高文件越大）
]
if (args.geo === 'draco') packArgs.push('-c') // gltfpack 用 Draco 兜底

if (!runNpx('gltfpack@latest', packArgs, 'gltfpack 减面 / 合并 / 纹理压缩')) {
  process.exit(1)
}

// 第二步：gltf-transform 收尾 —— 清理未引用资源 + 按所选方案压缩几何
const transformArgs = [
  'optimize', output, output,
  '--texture-size', String(args.texture),
  '--prune', // 删除未被引用的 mesh / material / texture
]
if (args.geo === 'meshopt') transformArgs.push('--compress', 'meshopt')
else transformArgs.push('--compress', 'draco')

runNpx('@gltf-transform/cli@latest', transformArgs, 'gltf-transform 清理 / 压缩')

// 第三步：体检
console.log('\n▸ 结构体检 ...')
try {
  const report = execFileSync('npx', ['--yes', '@gltf-transform/cli@latest', 'inspect', output], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    cwd: ROOT,
  })
  console.log(report)
} catch {
  console.warn('（体检跳过）')
}

// ---------------------------------------------------------------- 汇总

const after = existsSync(output) ? statSync(output).size : 0
const pct = before > 0 ? ((1 - after / before) * 100).toFixed(1) : '0'

console.log('─'.repeat(52))
console.log(`原始:   ${fmt(before)}`)
console.log(`优化后: ${fmt(after)}   (↓ ${pct}%)`)
console.log('─'.repeat(52))

// 红线校验
if (after > 5 * 1024 * 1024) {
  console.warn(
    `⚠ 单文件超过 5MB 红线。建议：\n` +
      `  · 降低 --ratio（如 0.3）\n` +
      `  · 降低 --texture（如 512）\n` +
      `  · 拆分成多个模型，按需加载`,
  )
} else {
  console.log('✓ 体积符合工业红线（≤ 5MB）')
}

console.log(`\n下一步：把 ${basename(output)} 放到 public/assets/models/，参考 ASSETS.md 第五节接入。`)
