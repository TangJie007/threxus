import type { DeviceRecord, DeviceStatus } from '@/data/devices'
import { statusText } from '@/data/devices'

/**
 * DOM 看板。
 *
 * 架构原则：3D 和 2D 看板之间只通过「状态 + 选中 id」通信，
 * 禁止 DOM 直接操作 Three.js 对象，也禁止渲染循环里直接读写 DOM 布局属性
 * （每帧读 offsetWidth 会触发强制同步布局，是隐形的性能杀手）。
 */
export class Dashboard {
  private readonly listEl = document.getElementById('device-list') as HTMLDivElement
  private readonly rightEl = document.getElementById('panel-right') as HTMLDivElement
  private readonly detailEl = document.getElementById('detail-body') as HTMLDivElement
  private readonly rows = new Map<string, HTMLDivElement>()
  private selectedId: string | null = null
  private dirty = true

  onSelect?: (id: string) => void
  onClose?: () => void

  constructor(private readonly devices: DeviceRecord[]) {
    this.buildList()
    document.getElementById('detail-close')?.addEventListener('click', () => {
      this.closeDetail()
      this.onClose?.()
    })
  }

  private buildList(): void {
    const frag = document.createDocumentFragment()
    for (const d of this.devices) {
      const row = document.createElement('div')
      row.className = 'dev'
      row.dataset.id = d.id
      row.innerHTML = `
        <i class="led led-${d.status}"></i>
        <span class="name">${d.name}</span>
        <span class="val">${d.metrics.temp.toFixed(0)}℃</span>
      `
      row.addEventListener('click', () => this.onSelect?.(d.id))
      row.addEventListener('mouseenter', () => this.onHover?.(d.id))
      row.addEventListener('mouseleave', () => this.onHover?.(null))
      this.rows.set(d.id, row)
      frag.appendChild(row)
    }
    this.listEl.appendChild(frag)
    const count = document.getElementById('dev-count')
    if (count) count.textContent = `${this.devices.length} 台`
  }

  onHover?: (id: string | null) => void

  select(id: string | null): void {
    this.selectedId = id
    for (const [rid, row] of this.rows) {
      row.classList.toggle('active', rid === id)
    }
    if (!id) {
      this.rightEl.style.display = 'none'
      return
    }
    const d = this.devices.find((x) => x.id === id)
    if (d) {
      this.rightEl.style.display = 'block'
      this.renderDetail(d)
    }
  }

  private renderDetail(d: DeviceRecord): void {
    const m = d.metrics
    this.detailEl.innerHTML = `
      <div class="kv"><span>设备编号</span><b>${d.id}</b></div>
      <div class="kv"><span>所属产线</span><b>${d.line}</b></div>
      <div class="kv"><span>设备类型</span><b>${d.type}</b></div>
      <div class="kv"><span>运行状态</span><b class="s-${d.status}">${statusText(d.status)}</b></div>
      <div class="kv"><span>主轴温度</span><b data-f="temp">${m.temp.toFixed(1)} ℃</b></div>
      <div class="kv"><span>转速</span><b data-f="speed">${m.speed} rpm</b></div>
      <div class="kv"><span>当班产量</span><b data-f="output">${m.output} 件</b></div>
      <div class="kv"><span>振动</span><b data-f="vibration">${m.vibration.toFixed(2)} mm/s</b></div>
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#7d8ea3">
          <span>负载率</span><b data-f="loadTxt" style="color:#d6e4f0">${m.load}%</b>
        </div>
        <div class="bar"><i data-f="loadBar" style="width:${m.load}%"></i></div>
      </div>
    `
  }

  private closeDetail(): void {
    this.rightEl.style.display = 'none'
    this.selectedId = null
    for (const row of this.rows.values()) row.classList.remove('active')
  }

  /** 数据推送时调用：只改文本节点，不重建 DOM */
  updateMetrics(d: DeviceRecord): void {
    if (!this.detailEl) return
    if (this.selectedId !== d.id) {
      // 列表行的温度文本
      const row = this.rows.get(d.id)
      const val = row?.querySelector('.val')
      if (val) val.textContent = `${d.metrics.temp.toFixed(0)}℃`
      return
    }
    const set = (f: string, v: string) => {
      const el = this.detailEl.querySelector<HTMLElement>(`[data-f="${f}"]`)
      if (el) el.textContent = v
    }
    set('temp', `${d.metrics.temp.toFixed(1)} ℃`)
    set('speed', `${d.metrics.speed} rpm`)
    set('output', `${d.metrics.output} 件`)
    set('vibration', `${d.metrics.vibration.toFixed(2)} mm/s`)
    set('loadTxt', `${d.metrics.load}%`)
    const bar = this.detailEl.querySelector<HTMLElement>('[data-f="loadBar"]')
    if (bar) bar.style.width = `${d.metrics.load}%`
  }

  updateStatus(d: DeviceRecord, status: DeviceStatus): void {
    const row = this.rows.get(d.id)
    if (row) {
      const led = row.querySelector('.led')
      if (led) led.className = `led led-${status}`
    }
    if (this.selectedId === d.id) this.renderDetail(d)
  }

  /** KPI 汇总：节流到 2Hz，避免每帧写 DOM */
  updateKPI(): void {
    if (!this.dirty) return
    this.dirty = false
    let run = 0
    let warn = 0
    let err = 0
    let loadSum = 0
    for (const d of this.devices) {
      if (d.status === 'ok') run++
      else if (d.status === 'warn') warn++
      else if (d.status === 'error') err++
      loadSum += d.metrics.load
    }
    const set = (id: string, v: string) => {
      const el = document.getElementById(id)
      if (el) el.textContent = v
    }
    set('kpi-run', String(run))
    set('kpi-warn', String(warn))
    set('kpi-err', String(err))
    const oee = this.devices.length
      ? Math.round((loadSum / this.devices.length) * 0.92)
      : 0
    set('kpi-oee', `${oee}%`)
  }

  invalidateKPI(): void {
    this.dirty = true
  }
}

/** 底部性能状态条 */
export class StatusBar {
  private acc = 0
  constructor(
    private readonly renderer: { info: { render: { calls: number; triangles: number }; memory: { geometries: number; textures: number } } },
  ) {}

  update(delta: number, fps: number): void {
    this.acc += delta
    if (this.acc < 0.4) return
    this.acc = 0
    const set = (id: string, v: string) => {
      const el = document.getElementById(id)
      if (el) el.textContent = v
    }
    set('st-fps', String(fps))
    set('st-calls', String(this.renderer.info.render.calls))
    set('st-tris', formatNum(this.renderer.info.render.triangles))
    set('st-geo', String(this.renderer.info.memory.geometries))
    set('st-tex', String(this.renderer.info.memory.textures))
  }
}

function formatNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}
