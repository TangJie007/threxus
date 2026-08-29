#!/usr/bin/env node
/**
 * 冒烟测试：真实浏览器里加载页面，抓运行时错误。
 *
 * 为什么必须有这一步 —— TypeScript 检查不出来以下问题：
 *  · GLSL shader 编译错误（顶点/片元着色器只在运行时编译）
 *  · Three.js 的 API 误用（属性名拼错、参数顺序错）
 *  · WebGL 上下文创建失败
 *
 * 用法：node scripts/smoke-test.mjs [url]
 */
import { chromium } from 'playwright'
import { unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

const URL = process.argv[2] || 'http://127.0.0.1:4173/'

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader', // headless 下用软件光栅化跑 WebGL
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
const warnings = []
const logs = []

page.on('console', (msg) => {
  const text = msg.text()
  if (msg.type() === 'error') errors.push(text)
  else if (msg.type() === 'warning') warnings.push(text)
  else logs.push(text)
})
page.on('pageerror', (e) => errors.push(`[PageError] ${e.message}\n${e.stack || ''}`))
page.on('requestfailed', (r) => {
  const f = r.failure()
  errors.push(`[RequestFailed] ${r.url()} — ${f ? f.errorText : 'unknown'}`)
})

console.log(`▶ 加载 ${URL}`)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })

// 第一步：等异步装配（boot）完成。
// 场景是加载完 glTF 之后才建起来的，__twin 也是那时候才挂上，
// 直接读统计会拿到装配前的空状态 —— 之前就是在这里误判成「渲染未启动」。
await page
  .waitForFunction(() => !!window.__twin?.factory, { timeout: 60000, polling: 300 })
  .catch((e) => {
    console.warn('⚠ 等待 boot 装配超时:', e.message.split('\n')[0])
  })

// 第二步：等渲染循环跑满一个统计周期。
// 不能用固定 sleep：SwiftShader 软件光栅化下 shader 首次编译可能要好几秒。
await page
  .waitForFunction(
    () =>
      window.__twin?.viewer?.fps > 0 &&
      document.getElementById('st-calls')?.textContent !== '0',
    { timeout: 60000, polling: 500 },
  )
  .catch((e) => {
    console.warn('⚠ 等待渲染就绪超时:', e.message.split('\n')[0])
  })
await page.waitForTimeout(2000)

// 读取运行状态
const stats = await page.evaluate(() => {
  const txt = (id) => document.getElementById(id)?.textContent ?? 'n/a'
  const twin = window.__twin
  const info = twin?.viewer?.renderer?.info
  return {
    fps: txt('st-fps'),
    drawCalls: txt('st-calls'),
    triangles: txt('st-tris'),
    geometries: txt('st-geo'),
    textures: txt('st-tex'),
    deviceCount: txt('dev-count'),
    kpiRun: txt('kpi-run'),
    kpiWarn: txt('kpi-warn'),
    kpiErr: txt('kpi-err'),
    oee: txt('kpi-oee'),
    devices: twin?.devices?.length ?? 0,
    sceneChildren: twin?.viewer?.scene?.children?.length ?? 0,
    programs: info?.programs?.length ?? -1,
    loadingHidden: !document.getElementById('loading'),
    tagCount: document.querySelectorAll('#label-host .tag').length,
    canvasSize: (() => {
      const c = document.querySelector('#canvas-host canvas')
      return c ? `${c.width}x${c.height}` : 'none'
    })(),
  }
})

// WebGL 是否真的在画东西：读画布中心像素
const pixel = await page.evaluate(() => {
  const c = document.querySelector('#canvas-host canvas')
  if (!c) return null
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  if (!gl) return { error: 'no webgl context' }
  const px = new Uint8Array(4)
  gl.readPixels(
    Math.floor(c.width / 2),
    Math.floor(c.height / 2),
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px,
  )
  return { rgba: Array.from(px) }
})

// 交互测试：点击设备列表第一项
await page.click('#device-list .dev:first-child')
await page.waitForTimeout(1500)
const afterClick = await page.evaluate(() => ({
  detailVisible: getComputedStyle(document.getElementById('panel-right')).display !== 'none',
  detailText: document.getElementById('detail-body')?.textContent?.trim().slice(0, 40) ?? '',
  activeRows: document.querySelectorAll('#device-list .dev.active').length,
}))

// 先删旧截图：某些环境（含受保护的工作目录）不允许覆写已存在的文件
try {
  await unlink(resolve(process.cwd(), 'smoke-screenshot.png'))
} catch {
  /* 本来就不存在，忽略 */
}
await page.screenshot({ path: 'smoke-screenshot.png' })
await browser.close()

// ---------------------------------------------------------------- 报告

console.log('\n══════ 冒烟测试报告 ══════')
console.log('渲染状态:', JSON.stringify(stats, null, 2))
console.log('中心像素:', JSON.stringify(pixel))
console.log('交互验证:', JSON.stringify(afterClick))

// shader 编译错误是重点排查对象
const shaderErrors = errors.filter((e) => /shader|glsl|program|compile/i.test(e))

console.log(`\n控制台错误 (${errors.length}):`)
errors.slice(0, 20).forEach((e) => console.log('  ✗', e.slice(0, 400)))

if (warnings.length) {
  console.log(`\n警告 (${warnings.length}):`)
  warnings.slice(0, 10).forEach((w) => console.log('  ⚠', w.slice(0, 300)))
}

console.log('\n─────────────────────────')
if (shaderErrors.length > 0) {
  console.log('❌ 存在 Shader 编译错误，必须修复')
  process.exit(1)
}
if (errors.length > 0) {
  console.log('❌ 存在运行时错误')
  process.exit(1)
}
if (stats.drawCalls === '0' || stats.drawCalls === 'n/a') {
  console.log('❌ 渲染循环未启动（Draw Call 为 0）')
  process.exit(1)
}
console.log('✅ 冒烟测试通过')
