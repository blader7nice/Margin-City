import type { Candle } from './types';

/**
 * Decision-time market reading. Every function here takes ONLY the candles visible at decision time
 * (session.visible()) — it has no access to the scenario, the dataset or the future. Tests mutate the future and
 * assert identical output.
 */

/** Simple moving average; value at i uses candles[i-n+1..i] only (null until enough data). */
export function sma(c: Candle[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < c.length; i++) {
    sum += c[i].c;
    if (i >= n) sum -= c[i - n].c;
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

/** Average true range (simple mean of TR); value at i uses data up to i only. */
export function atr(c: Candle[], n = 14): (number | null)[] {
  const tr = c.map((k, i) => (i === 0 ? k.h - k.l : Math.max(k.h - k.l, Math.abs(k.h - c[i - 1].c), Math.abs(k.l - c[i - 1].c))));
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    sum += tr[i];
    if (i >= n) sum -= tr[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export type Dir = 'up' | 'down';

export interface MarketContext {
  last: Candle;
  atr: number;
  atrPct: number;
  /** Current ATR relative to the median ATR of the window (1 = normal). */
  volRatio: number;
  trend: { slopeAtr: number; r2: number; dir: Dir | 'flat'; strength: 'strong' | 'moderate' | 'weak' };
  ma20: number | null;
  ma50: number | null;
  range: { hi: number; lo: number; widthAtr: number; isRange: boolean; pos: number };
  breakout: Dir | null;
  breakoutVolume: number;
  failedBreakout: Dir | null;
  climax: Dir | null;
  climaxVolume: number;
  /** Distance of the close from MA20 in ATR (signed). */
  stretchAtr: number;
  reversalCandle: 'bull' | 'bear' | null;
  structure: 'HH-HL' | 'LH-LL' | 'mixed';
  structureBreak: Dir | null;
  rebound: Dir | null;
  squeeze: boolean;
  lastVolRatio: number;
  swingLow: number;
  swingHigh: number;
  /** Human-readable observations (Polish) — exactly what the review shows as "what was visible". */
  observations: string[];
}

function regression(y: number[]): { slope: number; r2: number } {
  const n = y.length;
  const mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (y[i] - my);
    sxx += (i - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxy / (sxx || 1);
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, r2 };
}

function swings(c: Candle[], k = 2): { highs: { i: number; p: number }[]; lows: { i: number; p: number }[] } {
  const highs: { i: number; p: number }[] = [];
  const lows: { i: number; p: number }[] = [];
  for (let i = k; i < c.length - k; i++) {
    let isH = true;
    let isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (c[j].h >= c[i].h) isH = false;
      if (c[j].l <= c[i].l) isL = false;
    }
    if (isH) highs.push({ i, p: c[i].h });
    if (isL) lows.push({ i, p: c[i].l });
  }
  return { highs, lows };
}

export function analyze(visible: Candle[], decimals = 2): MarketContext {
  const c = visible;
  const n = c.length;
  if (n < 20) throw new Error('analyze: need at least 20 visible candles');
  const last = c[n - 1];
  const atrS = atr(c, 14);
  const a = atrS[n - 1] ?? last.h - last.l;
  const atrVals = atrS.filter((x): x is number => x != null);
  const volRatio = a / (median(atrVals) || a);
  const ma20 = sma(c, 20)[n - 1];
  const ma50 = n >= 50 ? sma(c, 50)[n - 1] : null;
  const f = (x: number) => x.toFixed(decimals);

  // Trend over the last 30 closes: slope in ATR per 10 bars, quality via R².
  const look = c.slice(-Math.min(30, n));
  const reg = regression(look.map((k) => k.c));
  const slopeAtr = (reg.slope * 10) / (a || 1);
  const absS = Math.abs(slopeAtr);
  const dir: MarketContext['trend']['dir'] = absS < 0.6 || reg.r2 < 0.25 ? 'flat' : slopeAtr > 0 ? 'up' : 'down';
  const strength: MarketContext['trend']['strength'] = dir === 'flat' ? 'weak' : absS > 2.2 && reg.r2 > 0.55 ? 'strong' : absS > 1.1 ? 'moderate' : 'weak';

  // Range: bounds over the 30 bars BEFORE the last 3.
  const base = c.slice(Math.max(0, n - 33), n - 3);
  const hi = Math.max(...base.map((k) => k.h));
  const lo = Math.min(...base.map((k) => k.l));
  const widthAtr = (hi - lo) / (a || 1);
  const baseReg = regression(base.map((k) => k.c));
  const isRange = widthAtr < 9 && Math.abs((baseReg.slope * 10) / (a || 1)) < 1.1;
  const pos = clamp01((last.c - lo) / Math.max(1e-9, hi - lo));

  // Volume.
  const vols = c.slice(-40).map((k) => k.v);
  const vMed = median(vols) || 1;
  const lastVolRatio = last.v / vMed;
  const recentVol = Math.max(...c.slice(-3).map((k) => k.v)) / vMed;

  // Breakout of the base range by the last 3 bars.
  let breakout: Dir | null = null;
  if (last.c > hi + 0.15 * a) breakout = 'up';
  else if (last.c < lo - 0.15 * a) breakout = 'down';
  // Failed breakout: within the last 10 bars price closed beyond the earlier range, now back inside.
  let failedBreakout: Dir | null = null;
  const early = c.slice(Math.max(0, n - 43), n - 10);
  if (early.length > 10 && !breakout) {
    const ehi = Math.max(...early.map((k) => k.h));
    const elo = Math.min(...early.map((k) => k.l));
    const recent = c.slice(n - 10, n - 1);
    if (recent.some((k) => k.c > ehi + 0.2 * a) && last.c < ehi) failedBreakout = 'up';
    else if (recent.some((k) => k.c < elo - 0.2 * a) && last.c > elo) failedBreakout = 'down';
  }

  // Climax: a big 1–3 bar move on exceptional volume, far from MA20. Measured against the market BEFORE the move
  // (the climax itself inflates ATR and the volume median).
  const move3 = last.c - c[n - 4].c;
  const stretchAtr = ma20 != null ? (last.c - ma20) / (a || 1) : 0;
  const atrBefore = atrS[n - 4] ?? a;
  const volBefore = median(c.slice(Math.max(0, n - 43), n - 3).map((k) => k.v)) || 1;
  const climaxVolume = Math.max(...c.slice(-3).map((k) => k.v)) / volBefore;
  let climax: Dir | null = null;
  if (climaxVolume > 2 && Math.abs(move3) > 2.5 * atrBefore && Math.abs(stretchAtr) > 2) climax = move3 < 0 ? 'down' : 'up';

  // Reversal candle on the last bar.
  const rng = Math.max(1e-9, last.h - last.l);
  const closePos = (last.c - last.l) / rng;
  const lowerWick = (Math.min(last.o, last.c) - last.l) / rng;
  const upperWick = (last.h - Math.max(last.o, last.c)) / rng;
  const prev = c[n - 2];
  let reversalCandle: MarketContext['reversalCandle'] = null;
  if ((lowerWick > 0.45 && closePos > 0.55) || (last.c > prev.h && prev.c < prev.o)) reversalCandle = 'bull';
  else if ((upperWick > 0.45 && closePos < 0.45) || (last.c < prev.l && prev.c > prev.o)) reversalCandle = 'bear';

  // Market structure from swing points.
  const sw = swings(c.slice(-45));
  const H = sw.highs.slice(-2);
  const L = sw.lows.slice(-2);
  let structure: MarketContext['structure'] = 'mixed';
  if (H.length === 2 && L.length === 2) {
    if (H[1].p > H[0].p && L[1].p > L[0].p) structure = 'HH-HL';
    else if (H[1].p < H[0].p && L[1].p < L[0].p) structure = 'LH-LL';
  }
  // Structure break: after a longer advance (decline), the close breaks the lowest low (highest high) of the
  // previous weeks' pullbacks — the first sign that the trend's rhythm is broken.
  let structureBreak: Dir | null = null;
  const prior = c.slice(Math.max(0, n - 60), n - 25);
  const longerSlope = prior.length > 10 ? (regression(prior.map((k) => k.c)).slope * 10) / (a || 1) : 0;
  const mid = c.slice(Math.max(0, n - 25), n - 4);
  const midLo = Math.min(...mid.map((k) => k.l));
  const midHi = Math.max(...mid.map((k) => k.h));
  if (longerSlope > 0.8 && last.c < midLo) structureBreak = 'down';
  else if (longerSlope < -0.8 && last.c > midHi) structureBreak = 'up';

  // Rebound: a big move in the last ~16 bars retraced by ≥ 55 %.
  let rebound: Dir | null = null;
  const seg = c.slice(-16);
  const segLoI = seg.reduce((bi, k, i) => (k.l < seg[bi].l ? i : bi), 0);
  const segHiI = seg.reduce((bi, k, i) => (k.h > seg[bi].h ? i : bi), 0);
  const startP = seg[0].o;
  if (segLoI > 0 && segLoI < seg.length - 2) {
    const drop = startP - seg[segLoI].l;
    if (drop > 4 * a && last.c - seg[segLoI].l > 0.55 * drop) rebound = 'up';
  }
  if (!rebound && segHiI > 0 && segHiI < seg.length - 2) {
    const rise = seg[segHiI].h - startP;
    if (rise > 4 * a && seg[segHiI].h - last.c > 0.55 * rise) rebound = 'down';
  }

  // Squeeze: recent ATR far below the window median.
  const squeeze = volRatio < 0.62;

  const swingLow = Math.min(...c.slice(-6).map((k) => k.l));
  const swingHigh = Math.max(...c.slice(-6).map((k) => k.h));

  // Observations (what a careful reader of this chart could say — nothing about the future).
  const obs: string[] = [];
  const trName = { up: 'wzrostowy', down: 'spadkowy' } as const;
  if (dir === 'flat') obs.push(`Brak wyraźnego trendu (nachylenie ${slopeAtr.toFixed(1)} ATR na 10 świec, R² ${reg.r2.toFixed(2)}).`);
  else obs.push(`Trend ${trName[dir]} — ${{ strong: 'silny', moderate: 'umiarkowany', weak: 'słaby' }[strength]} (${slopeAtr > 0 ? '+' : ''}${slopeAtr.toFixed(1)} ATR na 10 świec, R² ${reg.r2.toFixed(2)}).`);
  if (structure !== 'mixed') obs.push(structure === 'HH-HL' ? 'Struktura: wyższe szczyty i wyższe dołki.' : 'Struktura: niższe szczyty i niższe dołki.');
  if (ma20 != null) obs.push(`Cena ${last.c > ma20 ? 'powyżej' : 'poniżej'} średniej 20${ma50 != null ? ` i ${last.c > ma50 ? 'powyżej' : 'poniżej'} średniej 50` : ''}; odległość od MA20: ${stretchAtr.toFixed(1)} ATR.`);
  if (isRange && !breakout) obs.push(`Zakres ${f(lo)}–${f(hi)} (${widthAtr.toFixed(1)} ATR); cena w ${pos < 0.33 ? 'dolnej' : pos > 0.67 ? 'górnej' : 'środkowej'} części.`);
  if (breakout) obs.push(`Wybicie ${breakout === 'up' ? 'w górę' : 'w dół'} z zakresu ${f(lo)}–${f(hi)}; wolumen ${recentVol.toFixed(1)}× mediany.`);
  if (failedBreakout) obs.push(`Niedawne wybicie ${failedBreakout === 'up' ? 'w górę' : 'w dół'} nie utrzymało się — cena wróciła do zakresu.`);
  if (climax) obs.push(`Klimaks ${climax === 'down' ? 'spadków' : 'wzrostów'}: ruch ${Math.abs(move3 / atrBefore).toFixed(1)} ATR (sprzed ruchu) w 3 świece na wolumenie ${climaxVolume.toFixed(1)}× wcześniejszej mediany.`);
  if (reversalCandle) obs.push(reversalCandle === 'bull' ? 'Ostatnia świeca ma cechy odrzucenia niższych cen (długi dolny knot / pochłonięcie).' : 'Ostatnia świeca ma cechy odrzucenia wyższych cen (długi górny knot / pochłonięcie).');
  else if (climax) obs.push('Brak świecy potwierdzającej odwrócenie.');
  if (structureBreak) obs.push(`Zmiana struktury: po dłuższym ${structureBreak === 'down' ? 'wzroście cena przełamała dołki' : 'spadku cena przełamała szczyty'} z ostatnich tygodni.`);
  if (rebound) obs.push(`Szybkie odreagowanie ${rebound === 'up' ? 'w górę' : 'w dół'}: odrobione ponad 55% ostatniego ruchu.`);
  if (volRatio > 1.7) obs.push(`Zmienność wysoka: ATR ${volRatio.toFixed(1)}× typowego — ten sam stop to większa szansa przypadkowego trafienia.`);
  if (squeeze) obs.push(`Zmienność ściśnięta: ATR ${volRatio.toFixed(2)}× typowego, wolumen ${lastVolRatio.toFixed(1)}× mediany.`);

  return {
    last,
    atr: a,
    atrPct: (a / last.c) * 100,
    volRatio,
    trend: { slopeAtr, r2: reg.r2, dir, strength },
    ma20,
    ma50,
    range: { hi, lo, widthAtr, isRange, pos },
    breakout,
    breakoutVolume: recentVol,
    failedBreakout,
    climax,
    climaxVolume,
    stretchAtr,
    reversalCandle,
    structure,
    structureBreak,
    rebound,
    squeeze,
    lastVolRatio,
    swingLow,
    swingHigh,
    observations: obs,
  };
}
