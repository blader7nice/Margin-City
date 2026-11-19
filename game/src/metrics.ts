/** Frame-time metrics: ring buffer, percentiles, long-frame counting. */
export class FrameMetrics {
  private buf: Float32Array;
  private i = 0;
  private n = 0;
  long = 0; // frames > 33.3 ms
  total = 0;

  constructor(size = 600) {
    this.buf = new Float32Array(size);
  }

  push(ms: number): void {
    this.buf[this.i] = ms;
    this.i = (this.i + 1) % this.buf.length;
    this.n = Math.min(this.n + 1, this.buf.length);
    this.total++;
    if (ms > 33.4) this.long++;
  }

  reset(): void {
    this.i = 0;
    this.n = 0;
    this.long = 0;
    this.total = 0;
  }

  values(): number[] {
    return Array.from(this.buf.subarray(0, this.n));
  }

  stats(): { n: number; avg: number; p50: number; p95: number; p99: number; max: number; fps: number } {
    const v = this.values().sort((a, b) => a - b);
    if (!v.length) return { n: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0, fps: 0 };
    const pct = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
    const avg = v.reduce((s, x) => s + x, 0) / v.length;
    return { n: v.length, avg, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: v[v.length - 1], fps: 1000 / avg };
  }

  /** Draw a small frame-time graph (16.7 / 33.3 ms guides). */
  draw(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const maxMs = 50;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (const g of [16.7, 33.3]) {
      const y = h - (g / maxMs) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const v = this.buf;
    const count = Math.min(this.n, w);
    for (let k = 0; k < count; k++) {
      const idx = (this.i - count + k + v.length) % v.length;
      const ms = v[idx];
      ctx.fillStyle = ms > 33.4 ? '#ff4d5a' : ms > 17.5 ? '#ffb35a' : '#6ff3ff';
      const bh = Math.min(h, (ms / maxMs) * h);
      ctx.fillRect(w - count + k, h - bh, 1, bh);
    }
  }
}
