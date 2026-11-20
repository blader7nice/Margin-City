import type { Candle, Timeframe } from './types';

/**
 * Professional-looking candlestick chart on Canvas 2D (crisp at any DPR, no dependencies).
 * Price pane + synchronized volume pane, price & time axes, grid, last-price label, crosshair with OHLCV tooltip,
 * horizontal order levels (entry / stop / target) that can be dragged, trade markers.
 * The chart only ever receives the candles it is allowed to show — it cannot leak the future.
 */

export interface Level {
  id: 'stop' | 'target' | 'entry' | 'ref';
  price: number;
  color: string;
  label: string;
  draggable: boolean;
}

export interface Marker {
  index: number; // index into the candles passed to draw()
  price: number;
  kind: 'entry' | 'exit';
  color: string;
  label: string;
}

export interface ChartData {
  candles: Candle[];
  /** Total slots on the time axis (visible + future placeholders), so the layout never jumps. */
  slots: number;
  timeframe: Timeframe;
  priceMin: number;
  priceMax: number;
  levels: Level[];
  markers: Marker[];
  /** Index (in candles) after which candles are "revealed" (drawn with a subtle highlight band). */
  revealedFrom: number | null;
  decimals: number;
}

const COL = {
  bg: '#0b0f14',
  grid: '#17202b',
  axis: '#7d8a99',
  text: '#c9d4df',
  up: '#26a69a',
  down: '#ef5350',
  volUp: 'rgba(38,166,154,0.45)',
  volDown: 'rgba(239,83,80,0.45)',
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

const fmtTime = (t: number, tf: Timeframe) => {
  const d = new Date(t * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return tf === '1d' ? `${dd}.${mm}` : `${dd}.${mm} ${hh}:00`;
};

export class CandleChart {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: ChartData | null = null;
  private mouse: { x: number; y: number } | null = null;
  private dragging: Level['id'] | null = null;
  onLevelDrag: ((id: Level['id'], price: number) => void) | null = null;
  private layout = { w: 0, h: 0, padL: 8, padR: 78, padT: 12, priceH: 0, volTop: 0, volH: 0, timeH: 24 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (this.dragging && this.data) {
        const p = this.yToPrice(this.mouse.y);
        this.onLevelDrag?.(this.dragging, p);
      }
      this.updateCursor();
      this.draw();
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse = null;
      this.dragging = null;
      this.draw();
    });
    canvas.addEventListener('mousedown', (e) => {
      const lvl = this.levelAt(e.offsetY);
      if (lvl) this.dragging = lvl.id;
    });
    window.addEventListener('mouseup', () => (this.dragging = null));
  }

  private updateCursor(): void {
    if (!this.mouse) return;
    this.canvas.style.cursor = this.dragging || this.levelAt(this.mouse.y) ? 'ns-resize' : 'crosshair';
  }

  private levelAt(y: number): Level | null {
    if (!this.data) return null;
    for (const l of this.data.levels) {
      if (!l.draggable) continue;
      if (Math.abs(this.priceToY(l.price) - y) < 6) return l;
    }
    return null;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = this.layout;
    L.w = r.width;
    L.h = r.height;
    const body = L.h - L.padT - L.timeH;
    L.priceH = body * 0.76;
    L.volTop = L.padT + L.priceH + 8;
    L.volH = body - L.priceH - 8;
    this.draw();
  }

  set(data: ChartData): void {
    this.data = data;
    this.draw();
  }

  private slotW(): number {
    const L = this.layout;
    return (L.w - L.padL - L.padR) / Math.max(1, this.data!.slots);
  }
  private xOf(i: number): number {
    return this.layout.padL + (i + 0.5) * this.slotW();
  }
  priceToY(p: number): number {
    const d = this.data!;
    const L = this.layout;
    return L.padT + (1 - (p - d.priceMin) / (d.priceMax - d.priceMin)) * L.priceH;
  }
  yToPrice(y: number): number {
    const d = this.data!;
    const L = this.layout;
    return d.priceMin + (1 - (y - L.padT) / L.priceH) * (d.priceMax - d.priceMin);
  }

  draw(): void {
    const ctx = this.ctx;
    const L = this.layout;
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    const d = this.data;
    if (!d || !d.candles.length) return;
    const sw = this.slotW();
    const plotR = L.w - L.padR;
    // Future placeholder area (empty: nothing to see there yet).
    const lastX = this.xOf(d.candles.length - 1) + sw / 2;
    if (lastX < plotR) {
      ctx.fillStyle = COL.future;
      ctx.fillRect(lastX, L.padT, plotR - lastX, L.priceH + L.volH + 8);
    }
    if (d.revealedFrom != null && d.revealedFrom < d.candles.length) {
      const x0 = this.xOf(d.revealedFrom) - sw / 2;
      ctx.fillStyle = COL.reveal;
      ctx.fillRect(x0, L.padT, lastX - x0, L.priceH + L.volH + 8);
    }
    // Grid + price axis
    const step = niceStep(d.priceMax - d.priceMin, 7);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (let p = Math.ceil(d.priceMin / step) * step; p <= d.priceMax; p += step) {
      const y = Math.round(this.priceToY(p)) + 0.5;
      ctx.strokeStyle = COL.grid;
      ctx.beginPath();
      ctx.moveTo(L.padL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.fillStyle = COL.axis;
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(d.decimals), plotR + 8, y);
    }
    // Time axis (labels every N slots)
    const every = Math.max(1, Math.round(90 / sw));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tfSec = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }[d.timeframe];
    for (let i = Math.floor(every / 2); i < d.slots; i += every) {
      const x = Math.round(this.xOf(i)) + 0.5;
      ctx.strokeStyle = COL.grid;
      ctx.beginPath();
      ctx.moveTo(x, L.padT);
      ctx.lineTo(x, L.volTop + L.volH);
      ctx.stroke();
      const t = d.candles[0].t + i * tfSec;
      ctx.fillStyle = COL.axis;
      ctx.fillText(fmtTime(t, d.timeframe), x, L.volTop + L.volH + 6);
    }
    // Volume
    let vmax = 0;
    for (const c of d.candles) vmax = Math.max(vmax, c.v);
    const bw = Math.max(1, sw * 0.7);
    d.candles.forEach((c, i) => {
      const x = this.xOf(i);
      const h = (c.v / (vmax || 1)) * L.volH;
      ctx.fillStyle = c.c >= c.o ? COL.volUp : COL.volDown;
      ctx.fillRect(Math.round(x - bw / 2), Math.round(L.volTop + L.volH - h), Math.round(bw), Math.round(h));
    });
    // Candles
    d.candles.forEach((c, i) => {
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
      const top = Math.round(Math.min(yo, yc));
      const hh = Math.max(1, Math.round(Math.abs(yc - yo)));
      ctx.fillRect(Math.round(x - bw / 2), top, Math.round(bw), hh);
    });
    // Last price label
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
    // Order levels
    for (const lv of d.levels) {
      const y = Math.round(this.priceToY(lv.price)) + 0.5;
      if (y < L.padT || y > L.padT + L.priceH) continue;
      ctx.strokeStyle = lv.color;
      ctx.lineWidth = lv.draggable ? 1.5 : 1;
      ctx.setLineDash(lv.id === 'ref' ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(L.padL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = lv.color;
      ctx.fillText(`${lv.label}${lv.draggable ? '  ⇕' : ''}`, L.padL + 6, y - 3);
      ctx.font = '11px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      this.priceTag(y, lv.price.toFixed(d.decimals), lv.color, '#0b0f14');
    }
    // Markers
    for (const m of d.markers) {
      const x = this.xOf(m.index);
      const y = this.priceToY(m.price);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      if (m.kind === 'entry') {
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + 10);
        ctx.lineTo(x + 6, y + 10);
      } else {
        ctx.arc(x, y, 5, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(m.label, x, y + 12);
    }
    // Crosshair + tooltip
    if (this.mouse && this.mouse.x < plotR && this.mouse.y < L.volTop + L.volH) {
      const i = Math.floor((this.mouse.x - L.padL) / sw);
      ctx.strokeStyle = COL.cross;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(L.padL, Math.round(this.mouse.y) + 0.5);
      ctx.lineTo(plotR, Math.round(this.mouse.y) + 0.5);
      if (i >= 0 && i < d.candles.length) {
        const x = Math.round(this.xOf(i)) + 0.5;
        ctx.moveTo(x, L.padT);
        ctx.lineTo(x, L.volTop + L.volH);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.mouse.y < L.padT + L.priceH) this.priceTag(this.mouse.y, this.yToPrice(this.mouse.y).toFixed(d.decimals), '#3a4654', '#e6edf3');
      if (i >= 0 && i < d.candles.length) {
        const c = d.candles[i];
        const ch = ((c.c - c.o) / c.o) * 100;
        const txt = `${fmtTime(c.t, d.timeframe)} UTC   O ${c.o.toFixed(d.decimals)}  H ${c.h.toFixed(d.decimals)}  L ${c.l.toFixed(d.decimals)}  C ${c.c.toFixed(d.decimals)}  ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%   V ${Math.round(c.v).toLocaleString('pl-PL')}`;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(11,15,20,0.85)';
        const w = ctx.measureText(txt).width + 12;
        ctx.fillRect(L.padL + 4, L.padT + 2, w, 18);
        ctx.fillStyle = ch >= 0 ? COL.up : COL.down;
        ctx.fillText(txt, L.padL + 10, L.padT + 6);
      }
    }
  }

  private priceTag(y: number, text: string, bg: string, fg: string): void {
    const ctx = this.ctx;
    const L = this.layout;
    const x = L.w - L.padR + 2;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y - 9, L.padR - 4, 18);
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText(text, x + 6, y);
  }
}
