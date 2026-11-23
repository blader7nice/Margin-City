import { describe, expect, it } from 'vitest';
import { analyze, atr, sma } from '../src/replay/analysis';
import { bestDirectional, evaluateProcess, thesis } from '../src/replay/evaluate';
import { chartFeed } from '../src/replay/feed';
import { FAMILIES, buildScenarioData, parseScenarioId } from '../src/replay/market';
import { planDistribution } from '../src/replay/mc';
import { libraryScenario, scenarioFromId, storyScenario } from '../src/replay/scenarios';
import { ReplaySession } from '../src/replay/session';
import type { Candle, OrderInput, Scenario } from '../src/replay/types';

const ui = (draft: OrderInput) => ({ draft, useTp: true, ma20: true, ma50: true, volume: true });
const skip: OrderInput = { side: 'skip', sizeFrac: 0, stopPrice: null, takeProfit: null, thesis: 'no_edge', confidence: 2 };

/** Same scenario, different future (the past is untouched). */
function withFuture(sc: Scenario, f: (c: Candle, i: number) => Candle): Scenario {
  const candles = sc.dataset.candles.map((c, i) => (i > sc.decisionIndex ? f(c, i) : c));
  return { ...sc, dataset: { ...sc.dataset, candles } };
}
/** Smooth synthetic futures starting at the decision close (no opening gap): -3 % or +3 % per candle. */
function path(sc: Scenario, step: number): (c: Candle, i: number) => Candle {
  const ref = sc.dataset.candles[sc.decisionIndex].c;
  return (c, i) => {
    const k = i - sc.decisionIndex;
    const o = ref * (1 + step) ** (k - 1);
    const cl = ref * (1 + step) ** k;
    return { ...c, o, c: cl, h: Math.max(o, cl) * 1.002, l: Math.min(o, cl) * 0.998, v: c.v * 3 };
  };
}
let crash: (c: Candle, i: number) => Candle;
let moon: (c: Candle, i: number) => Candle;
const futures = (sc: Scenario) => ((crash = path(sc, -0.03)), (moon = path(sc, 0.03)));

describe('Market Replay 2.0 — scenario library', () => {
  it('has at least 10 distinct situations, each reproducible from its id', () => {
    expect(FAMILIES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(FAMILIES.map((f) => f.id)).size).toBe(FAMILIES.length);
    for (const f of FAMILIES) {
      const a = libraryScenario(f.id, f.seed);
      const b = scenarioFromId(`${f.id}-${f.seed}`)!;
      expect(b.dataset.candles).toEqual(a.dataset.candles);
      expect(a.id).toBe(`${f.id}-${f.seed}`);
      expect(libraryScenario(f.id, f.seed + 1).dataset.candles[a.decisionIndex].c).not.toBe(a.dataset.candles[a.decisionIndex].c);
      expect(a.dataset.meta.synthetic).toBe(true);
      expect(a.dataset.meta.source).toMatch(/NIE są to notowania/);
      expect(a.window).toBeGreaterThanOrEqual(40);
      expect(a.window).toBeLessThanOrEqual(80);
      expect(a.horizon).toBeGreaterThanOrEqual(20);
    }
    expect(parseScenarioId('panic-6637')).toEqual({ family: 'panic', seed: 6637 });
    expect(parseScenarioId('nonsense-1')).toBeNull();
  });

  it('candles are valid OHLCV (high/low bound open/close, positive volume, monotonic time)', () => {
    for (const f of FAMILIES) {
      const c = libraryScenario(f.id, 77).dataset.candles;
      for (let i = 0; i < c.length; i++) {
        expect(c[i].h).toBeGreaterThanOrEqual(Math.max(c[i].o, c[i].c));
        expect(c[i].l).toBeLessThanOrEqual(Math.min(c[i].o, c[i].c));
        expect(c[i].v).toBeGreaterThan(0);
        if (i) expect(c[i].t).toBeGreaterThan(c[i - 1].t);
      }
    }
  });

  it('no scripted outcome: in every family both directions are common across seeds', () => {
    for (const f of FAMILIES) {
      let up = 0;
      const N = 80;
      for (let s = 1; s <= N; s++) {
        const b = buildScenarioData(f.id, 1000 + s);
        if (b.candles[b.candles.length - 1].c > b.candles[b.decisionIndex].c) up++;
      }
      expect(up / N, f.id).toBeGreaterThan(0.2);
      expect(up / N, f.id).toBeLessThan(0.8);
    }
  });
});

describe('Market Replay 2.0 — no look-ahead anywhere', () => {
  it('indicators are causal: changing later candles never changes earlier values', () => {
    const sc = libraryScenario('trend-up', 5);
    futures(sc);
    const a = sc.dataset.candles;
    const b = withFuture(sc, crash).dataset.candles;
    const [ma20a, ma20b, atra, atrb] = [sma(a, 20), sma(b, 20), atr(a), atr(b)];
    for (let i = 0; i <= sc.decisionIndex; i++) {
      expect(ma20b[i]).toBe(ma20a[i]);
      expect(atrb[i]).toBe(atra[i]);
    }
  });

  it('the decision-time market reading is identical for any future', () => {
    for (const f of FAMILIES) {
      const sc = libraryScenario(f.id, f.seed);
      futures(sc);
      const r = (s: Scenario) => JSON.stringify(analyze(new ReplaySession(s).visible(), 2));
      expect(r(withFuture(sc, crash)), f.id).toBe(r(sc));
      expect(r(withFuture(sc, moon)), f.id).toBe(r(sc));
    }
  });

  it('the PROCESS grade is identical for any future (profit cannot buy a better grade)', () => {
    const sc = storyScenario();
    futures(sc);
    const s0 = new ReplaySession(sc);
    const x = analyze(s0.visible());
    const ref = s0.decisionCandle.c;
    const o: OrderInput = { side: 'long', sizeFrac: 0.3, stopPrice: ref * 0.96, takeProfit: ref * 1.1, thesis: 'capitulation_reversal', confidence: 3 };
    const grades = [sc, withFuture(sc, crash), withFuture(sc, moon)].map((v) => {
      const s = new ReplaySession(v);
      const pv = s.preview(o);
      s.submit(o);
      s.runToEnd();
      return { pnl: s.trade!.netPnl, proc: evaluateProcess(analyze(s.visible().slice(0, v.window)), o, pv, s.actions) };
    });
    expect(grades[1].pnl).toBeLessThan(0);
    expect(grades[2].pnl).toBeGreaterThan(0);
    expect(grades[1].proc.score).toBe(grades[0].proc.score);
    expect(grades[2].proc.score).toBe(grades[0].proc.score);
    expect(x.observations.length).toBeGreaterThan(0);
  });

  it('the chart feed never contains a candle beyond the cursor, before or during the reveal', () => {
    const sc = libraryScenario('breakout', 4421);
    const s = new ReplaySession(sc);
    const ref = s.decisionCandle.c;
    const o: OrderInput = { side: 'long', sizeFrac: 0.2, stopPrice: ref * 0.97, takeProfit: ref * 1.06, thesis: 'breakout_up', confidence: 2 };
    let feed = chartFeed(s, ui(o));
    expect(feed.candles[feed.candles.length - 1]).toBe(sc.dataset.candles[sc.decisionIndex]);
    expect(feed.candles.length).toBe(sc.window);
    expect(feed.overlays[0].values).toEqual(sma(s.visible(), 20));
    s.submit(o);
    for (let k = 0; k < 6; k++) {
      s.step();
      feed = chartFeed(s, ui(o));
      expect(feed.candles[feed.candles.length - 1]).toBe(sc.dataset.candles[s.cursor]);
      expect(feed.candles.every((c) => c.t <= sc.dataset.candles[s.cursor].t)).toBe(true);
    }
  });

  it('alternative futures are refused before the reveal (no probability oracle at decision time)', () => {
    const sc = libraryScenario('panic', 6637);
    expect(() => planDistribution(sc, skip, 20, 'analysis')).toThrow();
    const d = planDistribution(sc, skip, 40, 'review')!;
    expect(d.n).toBe(40);
    expect(d.winRate).toBeGreaterThan(0);
    expect(d.winRate).toBeLessThan(1);
  });
});

describe('Market Replay 2.0 — scoring rewards process and risk control, not profit', () => {
  it("owner's case: LONG into a strong downtrend on an unconfirmed 'capitulation' cannot get an A", () => {
    const s = new ReplaySession(storyScenario());
    const x = analyze(s.visible());
    expect(x.trend.dir).toBe('down');
    const ref = s.decisionCandle.c;
    const stop = x.swingLow - 0.15 * x.atr;
    for (const confidence of [1, 2, 3] as const) {
      const o: OrderInput = { side: 'long', sizeFrac: s.sizeForRisk(0.01, 'long', stop), stopPrice: stop, takeProfit: ref + 2 * (ref - stop), thesis: 'capitulation_reversal', confidence };
      const p = evaluateProcess(x, o, s.preview(o));
      expect(p.grade, `confidence ${confidence}`).not.toBe('A');
      expect(p.counterTrend).toBe(true);
    }
    const hi: OrderInput = { side: 'long', sizeFrac: 0.6, stopPrice: stop, takeProfit: ref + 2 * (ref - stop), thesis: 'capitulation_reversal', confidence: 3 };
    expect(['C', 'D']).toContain(evaluateProcess(x, hi, s.preview(hi)).grade);
  });

  it('a thesis that does not justify the side is capped, whatever the risk management', () => {
    const s = new ReplaySession(storyScenario());
    const x = analyze(s.visible());
    const ref = s.decisionCandle.c;
    const o: OrderInput = { side: 'long', sizeFrac: s.sizeForRisk(0.005, 'long', ref * 0.97), stopPrice: ref * 0.97, takeProfit: ref * 1.08, thesis: 'trend_down', confidence: 1 };
    const p = evaluateProcess(x, o, s.preview(o));
    expect(p.criteria.find((c) => c.id === 'context')!.value).toBe(0);
    expect(['C', 'D']).toContain(p.grade);
  });

  it('a trend-consistent plan (1% risk, stop beyond the swing, 2R target) earns an A', () => {
    let found = false;
    for (let seed = 1; seed < 200 && !found; seed++) {
      const s = new ReplaySession(libraryScenario('trend-up', seed));
      const x = analyze(s.visible());
      if (thesis('trend_up').support(x).score < 0.72) continue;
      found = true;
      const ref = s.decisionCandle.c;
      const stop = x.swingLow - 0.15 * x.atr;
      const o: OrderInput = { side: 'long', sizeFrac: s.sizeForRisk(0.01, 'long', stop), stopPrice: stop, takeProfit: ref + 2 * (ref - stop), thesis: 'trend_up', confidence: 3 };
      const p = evaluateProcess(x, o, s.preview(o));
      expect(p.grade, `seed ${seed}: ${JSON.stringify(p.criteria.map((c) => [c.id, c.value]))}`).toBe('A');
    }
    expect(found).toBe(true);
  });

  it('skipping a situation without edge is an A; skipping with a directional high-confidence thesis is not', () => {
    let checked = 0;
    for (let seed = 1; seed < 300 && checked < 3; seed++) {
      const s = new ReplaySession(libraryScenario('no-edge', seed));
      const x = analyze(s.visible());
      if (bestDirectional(x).score >= 0.45) continue;
      checked++;
      expect(evaluateProcess(x, skip, s.preview(skip)).grade).toBe('A');
      const odd: OrderInput = { ...skip, thesis: 'trend_up', confidence: 3 };
      expect(evaluateProcess(x, odd, s.preview(odd)).grade).not.toBe('A');
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('widening the stop after entry is penalised (plan consistency), tightening is not', () => {
    const sc = libraryScenario('trend-up', 1201);
    const mk = () => new ReplaySession(sc);
    const s = mk();
    const x = analyze(s.visible());
    const ref = s.decisionCandle.c;
    const stop = x.swingLow - 0.3 * x.atr;
    const o: OrderInput = { side: 'long', sizeFrac: s.sizeForRisk(0.01, 'long', stop), stopPrice: stop, takeProfit: null, thesis: 'trend_up', confidence: 2 };
    const pv = s.preview(o);
    s.submit(o);
    s.step();
    expect(s.position()).not.toBeNull();
    expect(s.modify('stop', stop - 3 * x.atr)).toBeNull();
    const widened = evaluateProcess(x, o, pv, s.actions);
    expect(widened.criteria.find((c) => c.id === 'plan')!.mark).toBe('bad');
    expect(widened.score).toBeLessThanOrEqual(64);
    const t = mk();
    t.submit(o);
    t.step();
    const pos = t.position()!;
    expect(t.modify('stop', Math.min(pos.price * 0.999, pos.entryPrice))).toBeNull();
    expect(evaluateProcess(x, o, pv, t.actions).criteria.find((c) => c.id === 'plan')!.mark).toBe('good');
    expect(ref).toBeGreaterThan(0);
  });
});

describe('Market Replay 2.0 — platform mechanics', () => {
  it('manual close fills at the NEXT open with slippage; invalid level moves are rejected', () => {
    const sc = libraryScenario('range', 3313);
    const s = new ReplaySession(sc);
    const ref = s.decisionCandle.c;
    const o: OrderInput = { side: 'short', sizeFrac: 0.2, stopPrice: ref * 1.1, takeProfit: null, thesis: 'range', confidence: 1 };
    s.submit(o);
    s.step();
    const pos = s.position()!;
    expect(s.modify('stop', pos.price * 0.99)).toMatch(/strat/);
    expect(s.modify('target', pos.price * 1.01)).toMatch(/zysku/);
    s.requestClose();
    const closeIdx = s.cursor + 1;
    s.step();
    expect(s.trade!.exitReason).toBe('manual');
    expect(s.trade!.exitIndex).toBe(closeIdx);
    expect(s.trade!.exitPrice).toBeCloseTo(sc.dataset.candles[closeIdx].o * (1 + 5 / 10000), 6);
  });

  it('risk-based sizing risks the requested share of capital (before costs), never with leverage', () => {
    const s = new ReplaySession(libraryScenario('trend-down', 2207));
    const ref = s.decisionCandle.c;
    const stop = ref * 1.03;
    const frac = s.sizeForRisk(0.01, 'short', stop);
    const pv = s.preview({ side: 'short', sizeFrac: frac, stopPrice: stop, takeProfit: null, thesis: 'trend_down', confidence: 2 });
    expect(pv.riskUsd! - pv.estCosts).toBeCloseTo(100, 4);
    expect(s.sizeForRisk(0.03, 'short', ref * 1.001)).toBe(1);
  });
});
