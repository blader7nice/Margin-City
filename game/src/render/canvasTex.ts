import * as THREE from 'three';

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Brass plate sign with engraved Deco lettering. */
export function signTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; glow?: string } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 1024;
  const h = opts.h ?? 192;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = opts.bg ?? '#2a2118';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = opts.fg ?? '#d9a85a';
    ctx.lineWidth = h * 0.04;
    ctx.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
    ctx.font = opts.font ?? `600 ${Math.floor(h * 0.42)}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = h * 0.15;
    }
    ctx.fillStyle = opts.fg ?? '#d9a85a';
    ctx.fillText(text, w / 2, h / 2 + h * 0.02, w * 0.9);
  });
}

/** Amber dot-matrix ticker board. Returns texture and a function that advances the scroll. */
export function tickerBoard(): { texture: THREE.CanvasTexture; update: (t: number) => void } {
  const W = 2048;
  const H = 192;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  // Fictional instruments only.
  const rows = [
    'MARGIN CITY EXCHANGE   ·   FLOOR CLOSED   ·   LAST SHIFT 23:58   ·   ',
    'MCX 412.80 ▼1.2   ·   DEMO/USD 98.90 ▲0.4   ·   ARGENT 77.15 ▼3.8   ·   HALCYON 19.02 ▲0.1   ·   ',
    'ALL TRADING SUSPENDED   ·   ARCHIVE WING DECOMMISSION 06:00   ·   ',
  ];
  let lastT = -1;
  const draw = (t: number) => {
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(0, 0, W, H);
    // dot grid
    ctx.fillStyle = '#1b130b';
    for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) ctx.fillRect(x, y, 4, 4);
    ctx.font = `bold 46px 'Courier New', monospace`;
    ctx.textBaseline = 'middle';
    rows.forEach((r, i) => {
      const speed = [60, 90, 45][i];
      const text = r.repeat(4);
      const width = ctx.measureText(r).width;
      const off = -((t * speed) % width);
      const y = 34 + i * 62;
      const flicker = i === 2 && Math.sin(t * 13.0) > 0.6 ? 0.35 : 1;
      ctx.globalAlpha = flicker;
      ctx.fillStyle = i === 2 ? '#ff5a3a' : '#ffb347';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillText(text, off, y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
    // dead panels: a few columns of the board are broken
    ctx.fillStyle = '#050403';
    for (const x of [420, 1290, 1720]) ctx.fillRect(x, 0, 96, H);
    tex.needsUpdate = true;
  };
  draw(0);
  return {
    texture: tex,
    update: (t: number) => {
      // Update at ~12 Hz: stepped motion like a real dot-matrix board, and cheap.
      const q = Math.floor(t * 12) / 12;
      if (q === lastT) return;
      lastT = q;
      draw(q);
    },
  };
}

/** Backlit glass clock face showing 23:58 — the Last Shift. */
export function clockFace(): THREE.CanvasTexture {
  const S = 1024;
  return canvasTexture(S, S, (ctx) => {
    const cx = S / 2;
    const r = S * 0.48;
    const g = ctx.createRadialGradient(cx, cx, r * 0.1, cx, cx, r);
    g.addColorStop(0, '#f3dcab');
    g.addColorStop(0.7, '#c99a58');
    g.addColorStop(1, '#6b4a24');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fill();
    // Deco sunburst segments
    ctx.strokeStyle = 'rgba(60,38,16,0.55)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.22, cx + Math.sin(a) * r * 0.22);
      ctx.lineTo(cx + Math.cos(a) * r * 0.78, cx + Math.sin(a) * r * 0.78);
      ctx.stroke();
    }
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3a2410';
    for (const rr of [0.22, 0.8, 0.97]) {
      ctx.beginPath();
      ctx.arc(cx, cx, r * rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#2b1a0b';
    ctx.font = `bold ${S * 0.075}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    numerals.forEach((n, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(n, cx + Math.cos(a) * r * 0.885, cx + Math.sin(a) * r * 0.885);
    });
    const hand = (angle: number, len: number, width: number) => {
      ctx.save();
      ctx.translate(cx, cx);
      ctx.rotate(angle);
      ctx.fillStyle = '#1a0f05';
      ctx.beginPath();
      ctx.moveTo(-width, r * 0.08);
      ctx.lineTo(0, -len);
      ctx.lineTo(width, r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    hand((58 / 60) * Math.PI * 2, r * 0.74, 12); // minutes: 58
    hand(((11 + 58 / 60) / 12) * Math.PI * 2, r * 0.5, 18); // hours: 23
  });
}

export function hazardStripes(): THREE.CanvasTexture {
  const t = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#c9a227';
    for (let x = -64; x < 320; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.lineTo(x + 32, 64);
      ctx.lineTo(x + 64, 0);
      ctx.lineTo(x + 32, 0);
      ctx.closePath();
      ctx.fill();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Corrugated steel stripes for the shutter (albedo). */
export function corrugated(): THREE.CanvasTexture {
  const t = canvasTexture(64, 256, (ctx) => {
    for (let y = 0; y < 256; y++) {
      const v = 0.5 + 0.5 * Math.sin((y / 256) * Math.PI * 2 * 16);
      const c = Math.floor(70 + v * 60);
      ctx.fillStyle = `rgb(${c},${c + 4},${c + 10})`;
      ctx.fillRect(0, y, 64, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft radial sprite used for light pools, dust and glows. */
export function radialSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)'): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}
