import type { Candle, Timeframe } from './types';

/**
 * Candlestick chart 2.0 on Canvas 2D (crisp at any DPR, no dependencies).
 *  - price pane + volume pane, price & time axes, grid, last-price tag;
 *  - viewport: mouse-wheel zoom around the cursor, drag to pan, double-click / "Dopasuj" to fit;
 *  - overlays: MA20 / MA50 (computed by the caller from VISIBLE candles only);
 *  - legend with OHLCV of the hovered (or last) candle, crosshair with price and time tags;
 *  - order levels: decision reference, entry, draggable stop / target.
 * The chart only ever receives the candles it is allowed to show — it cannot leak the future.
 * All text scales with the CSS font size of the canvas (UI scaling on large monitors).
 */

export interface Level {
  id: 'stop' | 'target' | 'entry' | 'ref';
  price: number;
  color: string;
  label: string;
  draggable: boolean;
}

export interface Marker {
  index: number; // index into the candles passed to set()
  price: number;
  kind: 'entry' | 'exit';
  color: string;
  label: string;
}

export interface Overlay {
  id: string;
  label: string;
  color: string;
  values: (number | null)[]; // aligned with candles
}

export interface ChartData {
  candles: Candle[];
  /** Total slots on the time axis (visible + future placeholders), so the layout never jumps. */
  slots: number;
  timeframe: Timeframe;
  levels: Level[];
  markers: Marker[];
  overlays: Overlay[];
  showVolume: boolean;
  /** Index (in candles) from which candles are "revealed" (drawn with a subtle highlight band). */
  revealedFrom: number | null;
  decimals: number;
  title: string;
}

const COL = {
  bg: '#0b0f14',
  grid: '#151d27',
  axis: '#8b98a8',
  text: '#c9d4df',
  up: '#26a69a',
  down: '#ef5350',
  volUp: 'rgba(38,166,154,0.42)',
  volDown: 'rgba(239,83,80,0.42)',
  cross: 'rgba(200,215,230,0.45)',
  reveal: 'rgba(255,190,90,0.05)',
  future: 'rgba(255,255,255,0.025)',
};

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * mag;
}

const TF_SEC: Record<Timeframe, number> = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
const fmtTime = (t: number, tf: Timeframe) => {
  const d = new Date(t * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return tf === '1d' ? `${dd}.${mm}` : `${dd}.${mm} ${hh}:${mi}`;
};

export function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

export class CandleChart {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: ChartData | null = null;
  private mouse: { x: number; y: number } | null = null;
  private dragging: Level['id'] | null = null;
  private panning: { x: number; from: number; to: number } | null = null;
  /** Viewport in slot units [from, to). */
  private view = { from: 0, to: 1 };
  private userView = false;
  private fs = 12;
  onLevelDrag: ((id: Level['id'], price: number) => void) | null = null;
  private L = { w: 0, h: 0, padL: 8, padR: 80, padT: 34, priceH: 0, volTop: 0, volH: 0, timeH: 26 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (this.dragging && this.data) this.onLevelDrag?.(this.dragging, this.yToPrice(this.mouse.y));
      else if (this.panning && this.data) {
        const dx = (this.mouse.x - this.panning.x) / this.slotW();
        const span = this.panning.to - this.panning.from;
        const from = Math.max(-span * 0.5, Math.min(this.data.slots - span * 0.5, this.panning.from - dx));
        this.view = { from, to: from + span };
        this.userView = true;
      }
      this.updateCursor();
      this.draw();
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse = null;
      this.dragging = null;
      this.panning = null;
      this.draw();
    });
    canvas.addEventListener('mousedown', (e) => {
      const lvl = this.levelAt(e.offsetY);
      if (lvl) this.dragging = lvl.id;
      else if (e.offsetX < this.L.w - this.L.padR) this.panning = { x: e.offsetX, from: this.view.from, to: this.view.to };
    });
    window.addEventListener('mouseup', () => {
      this.dragging = null;
      this.panning = null;
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.data) return;
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const at = this.view.from + ((e.clientX - r.left - this.L.padL) / Math.max(1, this.L.w - this.L.padL - this.L.padR)) * (this.view.to - this.view.from);
        this.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, at);
      },
      { passive: false },
    );
    canvas.addEventListener('dblclick', () => this.fit());
  }

  /** Zoom the time axis by `factor` (>1 = zoom out) around slot `at` (default: centre). */
  zoom(factor: number, at?: number): void {
    if (!this.data) return;
    const span = this.view.to - this.view.from;
    const c = at ?? (this.view.from + this.view.to) / 2;
    const ns = Math.max(12, Math.min(this.data.slots * 1.2, span * factor));
    const k = (c - this.view.from) / span;
    const from = c - k * ns;
    this.view = { from, to: from + ns };
    this.userView = true;
    this.draw();
  }

  fit(): void {
    this.userView = false;
    if (this.data) this.view = { from: 0, to: this.data.slots };
    this.draw();
  }

  private updateCursor(): void {
    if (!this.mouse) return;
    this.canvas.style.cursor = this.dragging || this.levelAt(this.mouse.y) ? 'ns-resize' : this.panning ? 'grabbing' : 'crosshair';
  }

  private levelAt(y: number): Level | null {
    if (!this.data) return null;
    for (const l of this.data.levels) {
      if (!l.draggable) continue;
      if (Math.abs(this.priceToY(l.price) - y) < Math.max(6, this.fs * 0.6)) return l;
    }
    return null;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fs = Math.max(11, Math.min(19, parseFloat(getComputedStyle(this.canvas).fontSize) || 13));
    const L = this.L;
    L.w = r.width;
    L.h = r.height;
    L.padR = Math.round(this.fs * 6.6);
    L.padT = Math.round(this.fs * 2.9);
    L.timeH = Math.round(this.fs * 2.1);
    this.layoutPanes();
    this.draw();
  }

  private layoutPanes(): void {
    const L = this.L;
    const body = L.h - L.padT - L.timeH;
    const vol = this.data?.showVolume ?? true;
    L.priceH = vol ? body * 0.78 : body - 6;
    L.volTop = L.padT + L.priceH + 8;
    L.volH = vol ? body - L.priceH - 8 : 0;
  }

  set(data: ChartData): void {
    const grew = !this.data || this.data.slots !== data.slots;
    this.data = data;
    if (grew || !this.userView) this.view = { from: 0, to: data.slots };
    this.layoutPanes();
    this.draw();
  }

  private slotW(): number {
    const L = this.L;
    return (L.w - L.padL - L.padR) / Math.max(1e-6, this.view.to - this.view.from);
  }
  private xOf(i: number): number {
    return this.L.padL + (i + 0.5 - this.view.from) * this.slotW();
  }
  private range(): { min: number; max: number } {
    const d = this.data!;
    let min = Infinity;
    let max = -Infinity;
    const i0 = Math.max(0, Math.floor(this.view.from));
    const i1 = Math.min(d.candles.length - 1, Math.ceil(this.view.to));
    for (let i = i0; i <= i1; i++) {
      const c = d.candles[i];
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
    }
    if (!isFinite(min)) {
      const last = d.candles[d.candles.length - 1];
      min = last.l;
      max = last.h;
    }
    for (const l of d.levels) {
      min = Math.min(min, l.price);
      max = Math.max(max, l.price);
    }
    const pad = (max - min) * 0.07 || max * 0.01;
    return { min: min - pad, max: max + pad };
  }
  private rng = { min: 0, max: 1 };
  priceToY(p: number): number {
    const L = this.L;
    return L.padT + (1 - (p - this.rng.min) / (this.rng.max - this.rng.min)) * L.priceH;
  }
  yToPrice(y: number): number {
    const L = this.L;
    return this.rng.min + (1 - (y - L.padT) / L.priceH) * (this.rng.max - this.rng.min);
  }

  draw(): void {
    const ctx = this.ctx;
    const L = this.L;
    const fs = this.fs;
    const mono = `${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    const d = this.data;
    if (!d || !d.candles.length) return;
    this.rng = this.range();
    const sw = this.slotW();
    const plotR = L.w - L.padR;
    const paneBottom = L.volTop + L.volH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.padL, 0, plotR - L.padL, L.h);
    ctx.clip();
    // Future placeholder + revealed band.
    const lastX = this.xOf(d.candles.length - 1) + sw / 2;
    if (lastX < plotR) {
      ctx.fillStyle = COL.future;
      ctx.fillRect(lastX, L.padT, plotR - lastX, paneBottom - L.padT);
    }
    if (d.revealedFrom != null && d.revealedFrom < d.candles.length) {
      const x0 = this.xOf(d.revealedFrom) - sw / 2;
      ctx.fillStyle = COL.reveal;
      ctx.fillRect(x0, L.padT, lastX - x0, paneBottom - L.padT);
    }
    ctx.restore();
    // Grid + price axis.
    const step = niceStep(this.rng.max - this.rng.min, Math.max(4, Math.round(L.priceH / (fs * 4))));
    ctx.font = mono;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (let p = Math.ceil(this.rng.min / step) * step; p <= this.rng.max; p += step) {
      const y = Math.round(this.priceToY(p)) + 0.5;
      ctx.strokeStyle = COL.grid;
      ctx.beginPath();
      ctx.moveTo(L.padL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.fillStyle = COL.axis;
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(d.decimals), plotR + fs * 0.6, y);
    }
    // Time axis.
    const every = Math.max(1, Math.round((fs * 9) / sw));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tfSec = TF_SEC[d.timeframe];
    const firstSlot = Math.max(0, Math.ceil(this.view.from / every) * every);
    for (let i = firstSlot; i < Math.min(d.slots, this.view.to); i += every) {
      const x = Math.round(this.xOf(i)) + 0.5;
      if (x < L.padL || x > plotR) continue;
      ctx.strokeStyle = COL.grid;
      ctx.beginPath();
      ctx.moveTo(x, L.padT);
      ctx.lineTo(x, paneBottom);
      ctx.stroke();
      ctx.fillStyle = COL.axis;
      ctx.fillText(fmtTime(d.candles[0].t + i * tfSec, d.timeframe), x, paneBottom + fs * 0.45);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.padL, 0, plotR - L.padL, L.h);
    ctx.clip();
    const i0 = Math.max(0, Math.floor(this.view.from) - 1);
    const i1 = Math.min(d.candles.length - 1, Math.ceil(this.view.to) + 1);
    const bw = Math.max(1, sw * 0.7);
    // Volume.
    if (d.showVolume) {
      let vmax = 0;
      for (let i = i0; i <= i1; i++) vmax = Math.max(vmax, d.candles[i].v);
      for (let i = i0; i <= i1; i++) {
        const c = d.candles[i];
        const x = this.xOf(i);
        const h = (c.v / (vmax || 1)) * L.volH;
        ctx.fillStyle = c.c >= c.o ? COL.volUp : COL.volDown;
        ctx.fillRect(Math.round(x - bw / 2), Math.round(L.volTop + L.volH - h), Math.max(1, Math.round(bw)), Math.round(h));
      }
    }
    // Candles.
    for (let i = i0; i <= i1; i++) {
      const c = d.candles[i];
      const x = Math.round(this.xOf(i)) + 0.5;
      const up = c.c >= c.o;
      ctx.strokeStyle = up ? COL.up : COL.down;
      ctx.fillStyle = up ? COL.up : COL.down;
      ctx.beginPath();
      ctx.moveTo(x, Math.round(this.priceToY(c.h)));
      ctx.lineTo(x, Math.round(this.priceToY(c.l)));
      ctx.stroke();
      const yo = this.priceToY(c.o);
      const yc = this.priceToY(c.c);
      ctx.fillRect(Math.round(x - bw / 2), Math.round(Math.min(yo, yc)), Math.max(1, Math.round(bw)), Math.max(1, Math.round(Math.abs(yc - yo))));
    }
    // Overlays (moving averages).
    for (const o of d.overlays) {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = Math.max(1.2, fs / 9);
      ctx.beginPath();
      let started = false;
      for (let i = i0; i <= i1; i++) {
        const v = o.values[i];
        if (v == null) {
          started = false;
          continue;
        }
        const x = this.xOf(i);
        const y = this.priceToY(v);
        if (!started) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        started = true;
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    // Markers.
    for (const m of d.markers) {
      const x = this.xOf(m.index);
      const y = this.priceToY(m.price);
      const s = fs * 0.55;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      if (m.kind === 'entry') {
        ctx.moveTo(x, y);
        ctx.lineTo(x - s, y + s * 1.7);
        ctx.lineTo(x + s, y + s * 1.7);
      } else ctx.arc(x, y, s * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 ${fs * 0.9}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(m.label, x, y + s * 2);
    }
    ctx.restore();
    // Last price.
    const last = d.candles[d.candles.length - 1];
    const ly = this.priceToY(last.c);
    const lastUp = last.c >= last.o;
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = lastUp ? COL.up : COL.down;
    ctx.beginPath();
    ctx.moveTo(L.padL, Math.round(ly) + 0.5);
    ctx.lineTo(plotR, Math.round(ly) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    this.priceTag(ly, last.c.toFixed(d.decimals), lastUp ? COL.up : COL.down, '#0b0f14');
    // Order levels.
    for (const lv of d.levels) {
      const y = Math.round(this.priceToY(lv.price)) + 0.5;
      if (y < L.padT || y > L.padT + L.priceH) continue;
      ctx.strokeStyle = lv.color;
      ctx.lineWidth = lv.draggable ? 1.8 : 1.2;
      ctx.setLineDash(lv.id === 'ref' || lv.id === 'entry' ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(L.padL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.font = `600 ${fs * 0.95}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = lv.color;
      // Non-draggable references are labelled on the right so they do not collide with STOP / CEL labels.
      if (lv.draggable) ctx.fillText(`${lv.label}  ⇕ przeciągnij`, L.padL + 8, y - 4);
      else {
        ctx.textAlign = 'right';
        ctx.fillText(lv.label, plotR - 8, y - 4);
      }
      this.priceTag(y, lv.price.toFixed(d.decimals), lv.color, '#0b0f14');
    }
    // Crosshair.
    let hover: number | null = null;
    if (this.mouse && !this.panning && this.mouse.x < plotR && this.mouse.y < paneBottom && this.mouse.y > L.padT) {
      const i = Math.floor((this.mouse.x - L.padL) / sw + this.view.from);
      ctx.strokeStyle = COL.cross;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(L.padL, Math.round(this.mouse.y) + 0.5);
      ctx.lineTo(plotR, Math.round(this.mouse.y) + 0.5);
      if (i >= 0 && i < d.candles.length) {
        const x = Math.round(this.xOf(i)) + 0.5;
        ctx.moveTo(x, L.padT);
        ctx.lineTo(x, paneBottom);
        hover = i;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.mouse.y < L.padT + L.priceH) this.priceTag(this.mouse.y, this.yToPrice(this.mouse.y).toFixed(d.decimals), '#3a4654', '#e6edf3');
      if (hover != null) {
        const tx = fmtTime(d.candles[hover].t, d.timeframe);
        ctx.font = mono;
        const w = ctx.measureText(tx).width + fs;
        const x = Math.round(this.xOf(hover));
        ctx.fillStyle = '#3a4654';
        ctx.fillRect(x - w / 2, paneBottom + 2, w, fs * 1.6);
        ctx.fillStyle = '#e6edf3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(tx, x, paneBottom + fs * 0.35);
      }
    }
    // Legend (platform style): title + OHLCV of the hovered / last candle + overlays.
    const li = hover ?? d.candles.length - 1;
    const c = d.candles[li];
    const ch = ((c.c - c.o) / c.o) * 100;
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ly0 = fs * 1.35;
    let x = L.padL + 6;
    ctx.fillStyle = '#e6edf3';
    ctx.fillText(d.title, x, ly0);
    x += ctx.measureText(d.title).width + fs;
    ctx.font = mono;
    const parts: [string, string][] = [
      ['O', c.o.toFixed(d.decimals)],
      ['H', c.h.toFixed(d.decimals)],
      ['L', c.l.toFixed(d.decimals)],
      ['C', c.c.toFixed(d.decimals)],
      ['', `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`],
      ['V', fmtVol(c.v)],
    ];
    for (const [k, v] of parts) {
      if (k) {
        ctx.fillStyle = COL.axis;
        ctx.fillText(k, x, ly0);
        x += ctx.measureText(k).width + fs * 0.3;
      }
      ctx.fillStyle = ch >= 0 ? COL.up : COL.down;
      ctx.fillText(v, x, ly0);
      x += ctx.measureText(v).width + fs * 0.9;
    }
    for (const o of d.overlays) {
      const v = o.values[li];
      if (v == null) continue;
      const txt = `${o.label} ${v.toFixed(d.decimals)}`;
      ctx.fillStyle = o.color;
      ctx.fillText(txt, x, ly0);
      x += ctx.measureText(txt).width + fs * 0.9;
    }
    ctx.fillStyle = COL.axis;
    ctx.textAlign = 'right';
    ctx.fillText(`${fmtTime(c.t, d.timeframe)} UTC`, plotR - 4, ly0);
  }

  private priceTag(y: number, text: string, bg: string, fg: string): void {
    const ctx = this.ctx;
    const L = this.L;
    const fs = this.fs;
    const x = L.w - L.padR + 2;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y - fs * 0.85, L.padR - 4, fs * 1.7);
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fs}px ui-monospace, monospace`;
    ctx.fillText(text, x + fs * 0.5, y);
  }
}
