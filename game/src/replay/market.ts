import type { Candle, Dataset, Timeframe } from './types';
import { mulberry32, TF_SECONDS } from './synthetic';

/**
 * Market model 2.0: seeded synthetic OHLCV that behaves like a market, not like a drawing.
 *
 *  - fat-tailed returns (Student-t, ν = 4) and GARCH-like volatility clustering;
 *  - intrabar paths (highs/lows come from a simulated path, not from a formula);
 *  - occasional opening gaps; volume tied to the size of the move, regime, and noise;
 *  - mean-reverting segments (consolidations) and drifting segments (trends).
 *
 * HONESTY RULES (tested in tests/replay2.test.ts):
 *  1. The PAST of a scenario is scripted by its family (that is the "situation" the player reads).
 *  2. The FUTURE is never scripted toward an outcome. Each seed draws its own future drift from a symmetric
 *     distribution, plus at most a WEAK, documented tendency (momentum ρ ≤ 0.3, mean reversion in ranges).
 *     For every family both outcomes are common (tests: 20–80 % of seeds end up, the rest down).
 *  3. Everything is labelled synthetic.
 */

export interface Segment {
  bars: number;
  /** Per-bar log drift. */
  drift?: number;
  /** Per-bar volatility (std of log return) before clustering. */
  vol: number;
  /** Volume multiplier. */
  volume?: number;
  /** Mean reversion toward a log-price anchor (set when the segment starts). Strength per bar. */
  kappa?: number;
  /** Probability of an opening gap per bar, and its scale in units of vol. */
  jumpProb?: number;
  jumpScale?: number;
}

export interface FutureSpec {
  bars: number;
  vol: number;
  /** Momentum: mean future drift = rho × reference drift (|rho| ≤ 0.3). */
  rho: number;
  refDrift: number;
  /** Std of the per-seed random drift (symmetric). */
  driftSd: number;
  /** Mean reversion strength if the range persists. */
  kappa?: number;
  /** Probability per seed that the range regime breaks mid-horizon (random direction). */
  breakProb?: number;
  volume?: number;
  jumpProb?: number;
  /** Volatility decays from this multiple of `vol` toward 1× over the horizon. */
  volStart?: number;
}

export interface ModelState {
  logP: number;
  sigmaMult: number;
  t: number;
  lastRet: number;
}

function gauss(rnd: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Student-t with ν = 4, scaled to unit variance (var of t4 = 2). */
function tShock(rnd: () => number): number {
  const z = gauss(rnd);
  let chi = 0;
  for (let i = 0; i < 4; i++) {
    const g = gauss(rnd);
    chi += g * g;
  }
  return z / Math.sqrt(chi / 4) / Math.SQRT2;
}

export interface SimOptions {
  timeframe: Timeframe;
  baseVolume: number;
  decimals: number;
  substeps?: number;
}

/** Simulate one bar from the state; mutates the state. */
function bar(rnd: () => number, st: ModelState, seg: Segment, anchor: number, o: SimOptions): Candle {
  const sub = o.substeps ?? 10;
  // GARCH(1,1)-style clustering on the volatility multiplier.
  const shockSq = Math.min(16, (st.lastRet / Math.max(1e-9, seg.vol)) ** 2);
  st.sigmaMult = Math.min(3, Math.max(0.5, Math.sqrt(0.06 + 0.08 * shockSq + 0.86 * st.sigmaMult * st.sigmaMult)));
  const sigma = seg.vol * st.sigmaMult;
  // Opening gap.
  if (seg.jumpProb && rnd() < seg.jumpProb) st.logP += tShock(rnd) * sigma * (seg.jumpScale ?? 2.5);
  const open = st.logP;
  let p = open;
  let hi = open;
  let lo = open;
  let absMove = 0;
  for (let k = 0; k < sub; k++) {
    const mr = seg.kappa ? -seg.kappa * (p - anchor) : 0;
    const step = ((seg.drift ?? 0) + mr) / sub + (sigma / Math.sqrt(sub)) * tShock(rnd);
    p += step;
    absMove += Math.abs(step);
    if (p > hi) hi = p;
    if (p < lo) lo = p;
  }
  st.lastRet = p - open;
  st.logP = p;
  const vol = o.baseVolume * (seg.volume ?? 1) * Math.exp(0.3 * gauss(rnd)) * (0.55 + (0.9 * absMove) / Math.max(1e-9, seg.vol * 2.2));
  const f = 10 ** o.decimals;
  const r = (x: number) => Math.round(Math.exp(x) * f) / f;
  const c: Candle = { t: st.t, o: r(open), h: r(hi), l: r(lo), c: r(p), v: Math.max(1, Math.round(vol)) };
  // Rounding must never break OHLC consistency.
  c.h = Math.max(c.h, c.o, c.c);
  c.l = Math.min(c.l, c.o, c.c);
  st.t += TF_SECONDS[o.timeframe];
  return c;
}

export function runSegments(rnd: () => number, st: ModelState, segs: Segment[], o: SimOptions): Candle[] {
  const out: Candle[] = [];
  for (const s of segs) {
    const anchor = st.logP;
    for (let i = 0; i < s.bars; i++) out.push(bar(rnd, st, s, anchor, o));
  }
  return out;
}

/** The future: a per-seed random drift (symmetric) + weak documented tendency; optional mid-horizon regime switch. */
export function runFuture(rnd: () => number, st: ModelState, f: FutureSpec, o: SimOptions): Candle[] {
  const drift1 = f.rho * f.refDrift + f.driftSd * gauss(rnd);
  const switchAt = rnd() < 0.35 ? Math.floor(f.bars * (0.35 + rnd() * 0.4)) : f.bars;
  const drift2 = f.driftSd * gauss(rnd);
  const breaks = f.kappa != null && rnd() < (f.breakProb ?? 0);
  const breakAt = breaks ? Math.floor(f.bars * (0.2 + rnd() * 0.5)) : f.bars;
  const breakDir = rnd() < 0.5 ? 1 : -1;
  const anchor = st.logP;
  const out: Candle[] = [];
  for (let i = 0; i < f.bars; i++) {
    const decay = f.volStart ? 1 + (f.volStart - 1) * Math.exp(-i / 6) : 1;
    const inRange = f.kappa != null && i < breakAt;
    const seg: Segment = {
      bars: 1,
      vol: f.vol * decay,
      drift: inRange ? 0 : i >= breakAt ? breakDir * f.vol * 0.55 : i < switchAt ? drift1 : drift2,
      kappa: inRange ? f.kappa : undefined,
      volume: (f.volume ?? 1) * (i >= breakAt && i < breakAt + 3 ? 1.8 : 1),
      jumpProb: f.jumpProb,
    };
    out.push(bar(rnd, st, seg, anchor, o));
  }
  return out;
}

// --------------------------------------------------------------------------------------------- families

export type FamilyId =
  | 'trend-up'
  | 'trend-down'
  | 'range'
  | 'breakout'
  | 'failed-breakout'
  | 'panic'
  | 'v-rebound'
  | 'structure-shift'
  | 'no-edge'
  | 'high-vol'
  | 'squeeze'
  | 'blowoff';

export interface FamilyInfo {
  id: FamilyId;
  title: string;
  /** What the player sees (never what happens next). */
  brief: string;
  /** Curated default seed for the training list. */
  seed: number;
}

/** Titles and briefs describe ONLY the visible situation, never the future. */
export const FAMILIES: FamilyInfo[] = [
  { id: 'trend-up', title: 'Trend wzrostowy', brief: 'Wyższe szczyty i dołki, cena powyżej średnich. Wchodzić teraz czy czekać na korektę?', seed: 1201 },
  { id: 'trend-down', title: 'Trend spadkowy', brief: 'Niższe szczyty i dołki. Kontynuacja czy łapanie spadającego noża?', seed: 2207 },
  { id: 'range', title: 'Konsolidacja', brief: 'Cena krąży między wyraźnymi granicami. Gdzie jesteś w zakresie?', seed: 3313 },
  { id: 'breakout', title: 'Wybicie z konsolidacji', brief: 'Ostatnie świece wyszły poza wielotygodniowy zakres. Czy wolumen to potwierdza?', seed: 4421 },
  { id: 'failed-breakout', title: 'Powrót po wybiciu', brief: 'Cena wyszła poza zakres i wróciła do środka. Co mówi ten powrót?', seed: 5527 },
  { id: 'panic', title: 'Panika', brief: 'Gwałtowna wyprzedaż na rekordowym wolumenie. Kapitulacja czy dopiero początek?', seed: 6637 },
  { id: 'v-rebound', title: 'Dynamiczne odbicie', brief: 'Po ostrym spadku równie ostry powrót. Ile z tego już jest w cenie?', seed: 7741 },
  { id: 'structure-shift', title: 'Zmiana struktury', brief: 'Długi wzrost, potem niższy szczyt i przełamanie ostatniego dołka.', seed: 8849 },
  { id: 'no-edge', title: 'Bez wyraźnej przewagi', brief: 'Szarpany rynek bez kierunku. Czy w ogóle jest tu transakcja?', seed: 9953 },
  { id: 'high-vol', title: 'Nadmierna zmienność', brief: 'Świece kilka razy większe niż zwykle, luki. Jak zmienia się wielkość pozycji?', seed: 1061 },
  { id: 'squeeze', title: 'Ściśnięcie zmienności', brief: 'Zakres świec kurczy się od tygodni, wolumen zamiera. Cisza przed czym?', seed: 1163 },
  { id: 'blowoff', title: 'Euforia', brief: 'Przyspieszający wzrost i rosnący wolumen. Trend czy szczyt?', seed: 1279 },
];

const INSTRUMENTS = [
  { symbol: 'MCX', name: 'MCX Composite (fikcyjny indeks)', price: [3200, 5200], decimals: 1, tf: '4h' as Timeframe, vol: 1, baseVolume: 42000 },
  { symbol: 'VPW', name: 'Velmar Paperworks (fikcyjna spółka)', price: [18, 64], decimals: 2, tf: '1d' as Timeframe, vol: 1.15, baseVolume: 820000 },
  { symbol: 'QGR', name: 'Quillon Grid (fikcyjna spółka)', price: [90, 260], decimals: 2, tf: '4h' as Timeframe, vol: 1, baseVolume: 210000 },
  { symbol: 'NOX/USD', name: 'Noctis (fikcyjne aktywo cyfrowe)', price: [0.4, 2.8], decimals: 4, tf: '1h' as Timeframe, vol: 1.35, baseVolume: 3.1e6 },
  { symbol: 'HBR', name: 'Halbrecht Rail (fikcyjna spółka)', price: [40, 140], decimals: 2, tf: '1h' as Timeframe, vol: 0.9, baseVolume: 95000 },
  { symbol: 'ODH', name: 'Orrin Dock Holdings (fikcyjna spółka)', price: [7, 30], decimals: 2, tf: '15m' as Timeframe, vol: 0.8, baseVolume: 26000 },
];

export const PAST_BARS = 80;
export const HORIZON = 30;

export interface Built {
  candles: Candle[];
  decisionIndex: number;
  meta: Dataset['meta'];
  decimals: number;
  family: FamilyInfo;
  /** Hidden model of the future (used only after the reveal, for the "alternative futures" panel). */
  model: { stateAtDecision: ModelState; future: FutureSpec; sim: SimOptions };
}

/** Deterministic: the same (family, seed) always yields identical candles. */
export function buildScenarioData(familyId: FamilyId, seed: number): Built {
  const fam = FAMILIES.find((f) => f.id === familyId);
  if (!fam) throw new Error(`unknown scenario family ${familyId}`);
  const rnd = mulberry32(Math.imul(seed >>> 0, 0x9e3779b1) ^ (FAMILIES.indexOf(fam) * 97 + 13));
  const u = (a: number, b: number) => a + (b - a) * rnd();
  const ui = (a: number, b: number) => Math.floor(u(a, b + 1));
  const sgn = () => (rnd() < 0.5 ? 1 : -1);
  const ins = INSTRUMENTS[ui(0, INSTRUMENTS.length - 1)];
  const v = 0.011 * ins.vol * u(0.85, 1.2);
  // Each family = a long "lead" (context) + a short scripted ending that defines the situation at the decision.
  let lead: Omit<Segment, 'bars'>;
  const end: Segment[] = [];
  let future: FutureSpec;
  const seg = (bars: number, x: Omit<Segment, 'bars'>) => end.push({ ...x, bars });
  switch (familyId) {
    case 'trend-up':
    case 'trend-down': {
      const d = familyId === 'trend-up' ? 1 : -1;
      const tr = d * v * u(0.25, 0.4);
      lead = { drift: tr, vol: v };
      seg(ui(4, 8), { drift: -tr * u(0.6, 1.1), vol: v * 0.9, volume: 0.8 });
      seg(ui(12, 20), { drift: tr * 1.1, vol: v, volume: 1.15 });
      if (rnd() < 0.5) seg(ui(3, 6), { drift: -tr * 0.8, vol: v * 0.9, volume: 0.85 });
      future = { bars: HORIZON, vol: v, rho: 0.25, refDrift: tr, driftSd: v * 0.22 };
      break;
    }
    case 'range': {
      lead = { drift: sgn() * v * 0.3, vol: v };
      seg(ui(46, 58), { vol: v, kappa: u(0.08, 0.14) });
      future = { bars: HORIZON, vol: v, rho: 0, refDrift: 0, driftSd: v * 0.2, kappa: 0.1, breakProb: 0.45 };
      break;
    }
    case 'breakout': {
      const d = sgn();
      lead = { drift: sgn() * v * 0.25, vol: v };
      seg(ui(44, 56), { vol: v * 0.85, kappa: u(0.1, 0.16), volume: 0.85 });
      seg(ui(3, 4), { drift: d * v * u(1.1, 1.5), vol: v * 1.3, volume: u(1.6, 2.6) });
      future = { bars: HORIZON, vol: v * 1.1, rho: 0.2, refDrift: d * v * 0.9, driftSd: v * 0.24, volStart: 1.3 };
      break;
    }
    case 'failed-breakout': {
      const d = sgn();
      lead = { drift: sgn() * v * 0.25, vol: v };
      seg(ui(40, 50), { vol: v * 0.85, kappa: u(0.1, 0.15), volume: 0.85 });
      seg(3, { drift: d * v * 1.3, vol: v * 1.2, volume: 1.9 });
      seg(ui(4, 6), { drift: -d * v * 1.0, vol: v * 1.15, volume: 1.5 });
      future = { bars: HORIZON, vol: v * 1.05, rho: 0.2, refDrift: -d * v * 0.6, driftSd: v * 0.24 };
      break;
    }
    case 'panic': {
      lead = { drift: v * 0.1, vol: v * 0.85 };
      seg(ui(7, 11), { drift: -v * 0.75, vol: v * 1.8, volume: 1.8 });
      seg(3, { drift: -v * u(2.2, 3), vol: v * 2.6, volume: u(3, 4.2), jumpProb: 0.25 });
      future = { bars: HORIZON, vol: v * 1.3, rho: 0, refDrift: 0, driftSd: v * 0.3, volStart: 1.8, jumpProb: 0.04 };
      break;
    }
    case 'v-rebound': {
      lead = { drift: v * 0.05, vol: v * 0.9 };
      seg(ui(9, 12), { drift: -v * 1.3, vol: v * 2, volume: 2.2 });
      seg(ui(6, 8), { drift: v * 1.5, vol: v * 1.8, volume: 1.9 });
      future = { bars: HORIZON, vol: v * 1.3, rho: 0.1, refDrift: v * 0.5, driftSd: v * 0.3, volStart: 1.4 };
      break;
    }
    case 'structure-shift': {
      const tr = v * u(0.3, 0.4);
      lead = { drift: tr, vol: v };
      seg(ui(7, 10), { drift: -tr * 1.3, vol: v * 1.05 });
      seg(ui(5, 7), { drift: tr * 0.9, vol: v, volume: 0.8 });
      seg(ui(4, 6), { drift: -tr * 2.2, vol: v * 1.25, volume: 1.5 });
      future = { bars: HORIZON, vol: v * 1.1, rho: 0.15, refDrift: -tr, driftSd: v * 0.25 };
      break;
    }
    case 'no-edge': {
      lead = { drift: sgn() * v * 0.2, vol: v * 1.1, kappa: 0.03 };
      for (let i = 0; i < 6; i++) seg(ui(6, 10), { drift: sgn() * v * u(0.2, 0.6), vol: v * u(1, 1.3), kappa: 0.04 });
      future = { bars: HORIZON, vol: v * 1.15, rho: 0, refDrift: 0, driftSd: v * 0.25, kappa: 0.05, breakProb: 0.2 };
      break;
    }
    case 'high-vol': {
      lead = { drift: sgn() * v * 0.15, vol: v };
      seg(ui(26, 34), { drift: sgn() * v * 0.2, vol: v * 3, volume: 1.9, jumpProb: 0.12, kappa: 0.04 });
      future = { bars: HORIZON, vol: v * 2.6, rho: 0, refDrift: 0, driftSd: v * 0.45, jumpProb: 0.1 };
      break;
    }
    case 'squeeze': {
      lead = { drift: sgn() * v * 0.3, vol: v * 1.3 };
      seg(ui(18, 24), { vol: v * 0.8, kappa: 0.1, volume: 0.8 });
      seg(ui(18, 24), { vol: v * 0.42, kappa: 0.15, volume: 0.55 });
      future = { bars: HORIZON, vol: v * 0.9, rho: 0, refDrift: 0, driftSd: v * 0.25, kappa: 0.12, breakProb: 0.7 };
      break;
    }
    case 'blowoff': {
      lead = { drift: v * 0.2, vol: v };
      seg(ui(9, 12), { drift: v * 0.7, vol: v * 1.4, volume: 1.6 });
      seg(3, { drift: v * u(2, 2.6), vol: v * 2.2, volume: u(2.8, 3.8) });
      future = { bars: HORIZON, vol: v * 1.4, rho: 0, refDrift: 0, driftSd: v * 0.3, volStart: 1.6 };
      break;
    }
  }
  const endBars = end.reduce((a, s) => a + s.bars, 0);
  const segs: Segment[] = [{ ...lead!, bars: Math.max(10, PAST_BARS - endBars) }, ...end];
  const sim: SimOptions = { timeframe: ins.tf, baseVolume: ins.baseVolume * u(0.7, 1.3), decimals: ins.decimals };
  const start = u(ins.price[0], ins.price[1]);
  const st: ModelState = { logP: Math.log(start), sigmaMult: 1, t: Date.UTC(2031, 0, 5) / 1000 + ui(0, 300) * 86400, lastRet: 0 };
  const past = runSegments(rnd, st, segs, sim);
  const stateAtDecision: ModelState = { ...st };
  const fut = runFuture(rnd, st, future!, sim);
  const candles = [...past, ...fut];
  return {
    candles,
    decisionIndex: past.length - 1,
    decimals: ins.decimals,
    family: fam,
    model: { stateAtDecision, future: future!, sim },
    meta: {
      id: `${familyId}-${seed}`,
      symbol: ins.symbol,
      name: ins.name,
      market: 'Rynek fikcyjny',
      venue: 'Symulator B-12',
      timeframe: ins.tf,
      timezone: 'UTC',
      currency: 'USD',
      source: `Model syntetyczny 2.0 · scenariusz ${familyId}-${seed} — NIE są to notowania rynkowe`,
      synthetic: true,
      license: 'Dane wygenerowane na potrzeby gry — brak ograniczeń',
      note: 'Przeszłość opisuje sytuację; przyszłość jest losowana dla każdego seeda (bez z góry ustalonego wyniku).',
    },
  };
}

/** Alternative futures from the same model state (only for the review — never before a decision). */
export function alternativeFutures(model: Built['model'], count: number, seed: number): Candle[][] {
  const out: Candle[][] = [];
  for (let k = 0; k < count; k++) {
    const rnd = mulberry32(seed * 7919 + k * 104729 + 1);
    const st: ModelState = { ...model.stateAtDecision };
    out.push(runFuture(rnd, st, model.future, model.sim));
  }
  return out;
}

export function parseScenarioId(id: string): { family: FamilyId; seed: number } | null {
  const m = /^([a-z-]+)-(\d{1,9})$/.exec(id.trim());
  if (!m) return null;
  const fam = FAMILIES.find((f) => f.id === m[1]);
  return fam ? { family: fam.id, seed: Number(m[2]) } : null;
}
