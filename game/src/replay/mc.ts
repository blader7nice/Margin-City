import { alternativeFutures } from './market';
import { ReplaySession } from './session';
import type { Distribution } from './evaluate';
import type { OrderInput, Scenario } from './types';

/**
 * "Alternative futures": the same plan replayed through N futures drawn from the scenario's own market model,
 * starting from the decision state. REVIEW ONLY — calling it before the decision is refused (it would be an oracle
 * that no trader has). Uses ReplaySession so the fill rules are exactly the game's rules.
 */
export function planDistribution(scenario: Scenario, order: OrderInput, n = 200, phase: 'analysis' | 'revealing' | 'review' = 'review'): Distribution | null {
  if (phase !== 'review') throw new Error('alternative futures are only available after the reveal');
  if (!scenario.model) return null;
  const past = scenario.dataset.candles.slice(0, scenario.decisionIndex + 1);
  const futures = alternativeFutures(scenario.model, n, hash(scenario.id));
  let target = 0;
  let stop = 0;
  let other = 0;
  let wins = 0;
  let rSum = 0;
  let rN = 0;
  const ends: number[] = [];
  const ref = past[past.length - 1].c;
  for (const f of futures) {
    const s = new ReplaySession({ ...scenario, dataset: { ...scenario.dataset, candles: [...past, ...f] }, horizon: Math.min(scenario.horizon, f.length - 1) });
    ends.push((f[Math.min(scenario.horizon, f.length) - 1].c / ref - 1) * 100);
    if (order.side === 'skip') continue;
    if (s.submit(order).length) return null;
    s.runToEnd();
    const tr = s.trade;
    if (!tr) continue;
    if (tr.exitReason === 'target') target++;
    else if (tr.exitReason === 'stop' || tr.exitReason === 'gap_stop') stop++;
    else other++;
    if (tr.netPnl > 0) wins++;
    if (tr.rMultiple != null) {
      rSum += tr.rMultiple;
      rN++;
    }
  }
  ends.sort((a, b) => a - b);
  const q = (p: number) => ends[Math.min(ends.length - 1, Math.floor(p * ends.length))];
  if (order.side === 'skip') {
    return { n, target: 0, stop: 0, other: 1, avgR: null, avgPct: ends.reduce((a, b) => a + b, 0) / n, winRate: ends.filter((e) => e > 0).length / n, p10: q(0.1), p90: q(0.9) };
  }
  return { n, target: target / n, stop: stop / n, other: other / n, avgR: rN ? rSum / rN : null, avgPct: ends.reduce((a, b) => a + b, 0) / n, winRate: wins / n, p10: q(0.1), p90: q(0.9) };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
