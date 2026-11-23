import { describe, expect, it } from 'vitest';
import { ReplaySession } from '../src/replay/session';
import { evaluate, evaluateOutcome, quadrant } from '../src/replay/evaluate';
import { analyze } from '../src/replay/analysis';
import { storyScenario, trainingScenario } from '../src/replay/scenarios';
import { SESSION_0417_REGIMES, generate } from '../src/replay/synthetic';
import type { Candle, OrderInput, Scenario } from '../src/replay/types';

const base: OrderInput = { side: 'skip', sizeFrac: 0, stopPrice: null, takeProfit: null, thesis: 'no_edge', confidence: 2 };

/** Hand-built scenario for exact fill tests. */
function scenarioFrom(candles: Candle[], decisionIndex: number, horizon: number): Scenario {
  return {
    id: 't',
    title: 't',
    dataset: { meta: { id: 't', symbol: 'T', name: 'T', market: 'T', venue: 'T', timeframe: '1h', timezone: 'UTC', currency: 'USD', source: 'test', synthetic: true, license: 'test' }, candles },
    decisionIndex,
    horizon,
    window: decisionIndex + 1,
    capital: 10000,
    costs: { feeBps: 0, slippageBps: 0 },
  };
}
const bar = (t: number, o: number, h: number, l: number, c: number): Candle => ({ t, o, h, l, c, v: 100 });

describe('Market Replay — no lookahead', () => {
  it('only candles up to the decision are visible, and the axis is scaled from them alone', () => {
    const s = new ReplaySession(storyScenario());
    const vis = s.visible();
    expect(vis[vis.length - 1]).toBe(s.candles[s.scenario.decisionIndex]);
    expect(vis.length).toBe(s.scenario.window);
    const range = s.priceRange();
    const future = s.candles.slice(s.scenario.decisionIndex + 1);
    const visHi = Math.max(...vis.map((c) => c.h));
    const visLo = Math.min(...vis.map((c) => c.l));
    // The range depends ONLY on visible data: identical to a range computed with the future removed.
    expect(range.max).toBeCloseTo(visHi + (visHi - visLo) * 0.06, 6);
    expect(range.min).toBeCloseTo(visLo - (visHi - visLo) * 0.06, 6);
    expect(future.length).toBeGreaterThan(0);
  });

  it('the cursor never advances before a decision is submitted', () => {
    const s = new ReplaySession(storyScenario());
    expect(s.step()).toBe(false);
    expect(s.cursor).toBe(s.scenario.decisionIndex);
  });

  it('the story future is generated with zero drift (not shaped to reward any decision)', () => {
    let past = 0;
    for (const r of SESSION_0417_REGIMES) {
      if (past >= 60) expect(r.drift).toBe(0);
      past += r.bars;
    }
    // Different seeds, same past regimes → futures diverge in both directions (no built-in answer).
    const ends = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const c = generate({ seed, start: 100, startTime: 0, timeframe: '4h', regimes: SESSION_0417_REGIMES, baseVolume: 1000 });
      return c[83].c / c[59].c - 1;
    });
    expect(ends.some((e) => e > 0)).toBe(true);
    expect(ends.some((e) => e < 0)).toBe(true);
  });
});

describe('Market Replay — fills, stops and costs', () => {
  const candles = [bar(0, 100, 101, 99, 100), bar(1, 100, 100.5, 99.5, 100), bar(2, 102, 104, 101, 103), bar(3, 103, 106, 102, 105), bar(4, 105, 105.5, 104, 104.5)];

  it('enters at the NEXT open, exits at the horizon close', () => {
    const s = new ReplaySession(scenarioFrom(candles, 1, 3));
    expect(s.submit({ ...base, side: 'long', sizeFrac: 0.5, thesis: 'trend_up' })).toEqual([]);
    s.runToEnd();
    expect(s.trade!.entryPrice).toBe(102);
    expect(s.trade!.exitReason).toBe('horizon');
    expect(s.trade!.exitPrice).toBe(104.5);
    expect(s.trade!.netPnl).toBeCloseTo((5000 / 102) * 2.5, 6);
  });

  it('a candle touching both stop and target counts as the stop (conservative)', () => {
    const c2 = [bar(0, 100, 101, 99, 100), bar(1, 100, 100, 100, 100), bar(2, 100, 110, 90, 100), bar(3, 100, 101, 99, 100)];
    const s = new ReplaySession(scenarioFrom(c2, 1, 2));
    s.submit({ ...base, side: 'long', sizeFrac: 1, stopPrice: 95, takeProfit: 105, thesis: 'trend_up' });
    s.runToEnd();
    expect(s.trade!.exitReason).toBe('stop');
    expect(s.trade!.exitPrice).toBe(95);
  });

  it('a gap through the stop fills at the open, not at the stop', () => {
    const c3 = [bar(0, 100, 101, 99, 100), bar(1, 100, 100, 100, 100), bar(2, 100, 101, 99, 100), bar(3, 90, 91, 89, 90)];
    const s = new ReplaySession(scenarioFrom(c3, 1, 2));
    s.submit({ ...base, side: 'long', sizeFrac: 1, stopPrice: 95, thesis: 'trend_up' });
    s.runToEnd();
    expect(s.trade!.exitReason).toBe('gap_stop');
    expect(s.trade!.exitPrice).toBe(90);
  });

  it('fees and slippage reduce the result on both fills', () => {
    const sc = scenarioFrom(candles, 1, 3);
    sc.costs = { feeBps: 10, slippageBps: 5 };
    const s = new ReplaySession(sc);
    s.submit({ ...base, side: 'short', sizeFrac: 0.5, thesis: 'trend_down' });
    s.runToEnd();
    const t = s.trade!;
    expect(t.entryPrice).toBeCloseTo(102 * (1 - 0.0005), 6);
    expect(t.exitPrice).toBeCloseTo(104.5 * (1 + 0.0005), 6);
    expect(t.fees).toBeGreaterThan(0);
    expect(t.netPnl).toBeLessThan(t.grossPnl);
  });

  it('SKIP is a complete decision with zero PnL and no trade', () => {
    const s = new ReplaySession(storyScenario());
    s.submit({ ...base });
    s.runToEnd();
    expect(s.phase).toBe('review');
    expect(s.trade).toBeNull();
    expect(s.cursor).toBe(s.endIndex);
  });

  it('rejects stops and targets on the wrong side of the price', () => {
    const s = new ReplaySession(storyScenario());
    const ref = s.decisionCandle.c;
    expect(s.submit({ ...base, side: 'long', sizeFrac: 0.1, stopPrice: ref * 1.01, thesis: 'trend_up' }).length).toBeGreaterThan(0);
    expect(s.submit({ ...base, side: 'short', sizeFrac: 0.1, stopPrice: ref * 1.02, takeProfit: ref * 1.05, thesis: 'trend_down' }).length).toBeGreaterThan(0);
    expect(s.phase).toBe('analysis');
  });

  it('risk preview: quantity × stop distance + estimated costs', () => {
    const s = new ReplaySession(storyScenario());
    const ref = s.decisionCandle.c;
    const p = s.preview({ ...base, side: 'long', sizeFrac: 0.2, stopPrice: ref * 0.95, thesis: 'capitulation_reversal' });
    const qty = 2000 / ref;
    expect(p.riskUsd!).toBeCloseTo(qty * ref * 0.05 + 2000 * 0.003, 4);
    expect(p.riskPct!).toBeCloseTo(p.riskUsd! / 10000, 8);
  });
});

describe('Market Replay — process evaluation (not just PnL)', () => {
  const ctxOf = (s: ReplaySession) => analyze(s.visible());
  it('a reasoned SKIP is never graded below B, and is judged without any trade', () => {
    const s = new ReplaySession(storyScenario());
    const o = { ...base };
    const e = evaluate(o, s.preview(o), null, ctxOf(s));
    expect(['A', 'B']).toContain(e.processGrade);
    expect(e.outcome).toBe('skip');
  });

  it('no stop + big size + low confidence grades D even if it made money', () => {
    const s = new ReplaySession(storyScenario());
    const o: OrderInput = { side: 'long', sizeFrac: 0.9, stopPrice: null, takeProfit: null, thesis: 'trend_down', confidence: 1 };
    const e = evaluate(o, s.preview(o), null, ctxOf(s));
    expect(e.processGrade).toBe('D');
    const q = quadrant(e.process, evaluateOutcome({ netPnl: 500 } as never, 10000));
    expect(q).toMatch(/szczęśliwy/);
  });

  it('a small, stopped trade with a partially supported thesis is capped at B even when it would have won', () => {
    const s = new ReplaySession(storyScenario());
    const x = ctxOf(s);
    const ref = s.decisionCandle.c;
    const stop = x.swingLow - 0.15 * x.atr;
    const o: OrderInput = { side: 'long', sizeFrac: s.sizeForRisk(0.01, 'long', stop), stopPrice: stop, takeProfit: ref + 2.5 * (ref - stop), thesis: 'capitulation_reversal', confidence: 2 };
    const e = evaluate(o, s.preview(o), null, x);
    expect(e.processGrade).not.toBe('A');
    expect(['B', 'C']).toContain(e.processGrade);
    expect(e.process.caps.join(' ')).toMatch(/częściowo|pokrycia/);
  });

  it('training sessions are labelled synthetic and respect the 40–80 visible-candle rule', () => {
    for (const seed of [3, 17, 99]) {
      const sc = trainingScenario(seed);
      expect(sc.dataset.meta.synthetic).toBe(true);
      expect(sc.window).toBeGreaterThanOrEqual(40);
      expect(sc.window).toBeLessThanOrEqual(80);
      const s = new ReplaySession(sc);
      expect(s.visible().length).toBe(sc.window);
    }
  });
});
