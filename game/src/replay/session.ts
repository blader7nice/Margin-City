import type { Candle, ManagementAction, OrderInput, Scenario, Trade } from './types';

/**
 * Replay session — the honest core of the terminal.
 *
 *  - Before the decision only candles[0..decisionIndex] exist for the UI (visible()). Price-axis autoscale is
 *    computed from visible candles only, so even the axis cannot leak the future.
 *  - The decision is taken at the CLOSE of the decision candle; the entry fills at the NEXT candle's OPEN
 *    plus adverse slippage (you cannot trade a price you already saw).
 *  - Stops/targets are checked against each new candle's high/low. A gap through the stop fills at the open.
 *    When a single candle touches BOTH stop and target we assume the stop came first (conservative, stated in UI).
 *  - Fees per side on notional, slippage on both fills. SKIP is a complete, valid decision.
 *  - After entry the player may manage the position like on a real platform: move the stop / target or close.
 *    Every action is logged with the candle it was taken on (the evaluation judges it with that information only).
 *    A manual close fills at the NEXT candle's open + slippage (same rule as the entry).
 */

export type Phase = 'analysis' | 'revealing' | 'review';

export interface OrderPreview {
  refPrice: number;
  qty: number;
  notional: number;
  riskUsd: number | null;
  riskPct: number | null;
  rewardRisk: number | null;
  estCosts: number;
  errors: string[];
}

export class ReplaySession {
  readonly scenario: Scenario;
  phase: Phase = 'analysis';
  /** Index of the last visible candle. */
  cursor: number;
  order: OrderInput | null = null;
  trade: Trade | null = null;
  /** Live stop / target (start as the plan, may be changed after entry). */
  liveStop: number | null = null;
  liveTp: number | null = null;
  readonly actions: ManagementAction[] = [];
  private pendingClose = false;
  private open: {
    side: 'long' | 'short';
    entryIndex: number;
    entryPrice: number;
    qty: number;
    notional: number;
    maxP: number;
    minP: number;
    entrySlip: number;
  } | null = null;

  constructor(scenario: Scenario) {
    this.scenario = scenario;
    if (scenario.decisionIndex + scenario.horizon >= scenario.dataset.candles.length) throw new Error('scenario horizon exceeds data');
    this.cursor = scenario.decisionIndex;
  }

  get candles(): Candle[] {
    return this.scenario.dataset.candles;
  }

  /** Candles the player may see right now (never beyond the cursor). */
  visible(): Candle[] {
    const start = Math.max(0, this.scenario.decisionIndex - this.scenario.window + 1);
    return this.candles.slice(start, this.cursor + 1);
  }

  get decisionCandle(): Candle {
    return this.candles[this.scenario.decisionIndex];
  }

  get endIndex(): number {
    return this.scenario.decisionIndex + this.scenario.horizon;
  }

  /** Price range for autoscale — from visible candles (+ planned levels) only. */
  priceRange(extra: (number | null | undefined)[] = []): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const c of this.visible()) {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
    }
    for (const e of extra) {
      if (e == null || !isFinite(e)) continue;
      min = Math.min(min, e);
      max = Math.max(max, e);
    }
    const pad = (max - min) * 0.06;
    return { min: min - pad, max: max + pad };
  }

  /** Live preview of an order (risk, size, costs). Uses the decision close as the reference price. */
  preview(o: OrderInput): OrderPreview {
    const errors: string[] = [];
    const ref = this.decisionCandle.c;
    const capital = this.scenario.capital;
    if (o.side === 'skip') return { refPrice: ref, qty: 0, notional: 0, riskUsd: 0, riskPct: 0, rewardRisk: null, estCosts: 0, errors };
    const frac = Math.max(0, Math.min(1, o.sizeFrac));
    if (frac <= 0) errors.push('Ustaw wielkość pozycji.');
    const notional = capital * frac;
    const qty = notional / ref;
    const { feeBps, slippageBps } = this.scenario.costs;
    const estCosts = notional * ((2 * feeBps + 2 * slippageBps) / 10000);
    let riskUsd: number | null = null;
    let rewardRisk: number | null = null;
    if (o.stopPrice != null) {
      const wrongSide = o.side === 'long' ? o.stopPrice >= ref : o.stopPrice <= ref;
      if (wrongSide) errors.push(o.side === 'long' ? 'Stop-loss dla LONG musi być poniżej ceny.' : 'Stop-loss dla SHORT musi być powyżej ceny.');
      else riskUsd = qty * Math.abs(ref - o.stopPrice) + estCosts;
    }
    if (o.takeProfit != null) {
      const wrongTp = o.side === 'long' ? o.takeProfit <= ref : o.takeProfit >= ref;
      if (wrongTp) errors.push(o.side === 'long' ? 'Take-profit dla LONG musi być powyżej ceny.' : 'Take-profit dla SHORT musi być poniżej ceny.');
      else if (o.stopPrice != null) rewardRisk = Math.abs(o.takeProfit - ref) / Math.max(1e-9, Math.abs(ref - o.stopPrice));
    }
    return { refPrice: ref, qty, notional, riskUsd, riskPct: riskUsd != null ? riskUsd / capital : null, rewardRisk, estCosts, errors };
  }

  /** Lock the decision. Returns validation errors (empty = accepted). */
  submit(o: OrderInput): string[] {
    if (this.phase !== 'analysis') return ['Decyzja już podjęta.'];
    const p = this.preview(o);
    if (p.errors.length) return p.errors;
    this.order = { ...o, sizeFrac: Math.max(0, Math.min(1, o.sizeFrac)) };
    this.liveStop = o.side === 'skip' ? null : o.stopPrice;
    this.liveTp = o.side === 'skip' ? null : o.takeProfit;
    this.phase = 'revealing';
    return [];
  }

  /** Notional fraction that risks `riskFrac` of capital with the given stop (no leverage: capped at 100 %). */
  sizeForRisk(riskFrac: number, side: 'long' | 'short', stop: number): number {
    const ref = this.decisionCandle.c;
    const dist = side === 'long' ? ref - stop : stop - ref;
    if (!(dist > 0)) return 0;
    const qty = (riskFrac * this.scenario.capital) / dist;
    return Math.max(0, Math.min(1, (qty * ref) / this.scenario.capital));
  }

  /** Open position snapshot for the UI (null before entry / after exit). */
  position(): { side: 'long' | 'short'; entryPrice: number; qty: number; price: number; unrealized: number; r: number | null; stop: number | null; target: number | null; closing: boolean } | null {
    if (!this.open) return null;
    const t = this.open;
    const price = this.candles[this.cursor].c;
    const dir = t.side === 'long' ? 1 : -1;
    const { feeBps, slippageBps } = this.scenario.costs;
    // Net of the fees already paid and the estimated exit costs.
    const exitCost = t.qty * price * ((feeBps + slippageBps) / 10000);
    const unrealized = dir * t.qty * (price - t.entryPrice) - t.notional * (feeBps / 10000) - exitCost;
    const plan = this.order!.stopPrice;
    const risk = plan != null ? t.qty * Math.abs(t.entryPrice - plan) : null;
    return { side: t.side, entryPrice: t.entryPrice, qty: t.qty, price, unrealized, r: risk ? unrealized / risk : null, stop: this.liveStop, target: this.liveTp, closing: this.pendingClose };
  }

  /** Move the stop or target of the open position. Returns an error message or null. */
  modify(kind: 'stop' | 'target', value: number | null): string | null {
    if (this.phase !== 'revealing' || !this.open) return 'Brak otwartej pozycji.';
    const t = this.open;
    const price = this.candles[this.cursor].c;
    if (value != null) {
      if (kind === 'stop' && (t.side === 'long' ? value >= price : value <= price)) return 'Stop musi być po stronie straty względem bieżącej ceny.';
      if (kind === 'target' && (t.side === 'long' ? value <= price : value >= price)) return 'Cel musi być po stronie zysku względem bieżącej ceny.';
    }
    const from = kind === 'stop' ? this.liveStop : this.liveTp;
    if (from === value) return null;
    if (kind === 'stop') this.liveStop = value;
    else this.liveTp = value;
    this.actions.push({ index: this.cursor, kind, from, to: value });
    return null;
  }

  /** Close at the next candle's open (+ slippage). */
  requestClose(): void {
    if (this.phase !== 'revealing' || !this.open || this.pendingClose) return;
    this.pendingClose = true;
    this.actions.push({ index: this.cursor, kind: 'close', from: null, to: null });
  }

  /** Reveal the next candle. Returns false when the replay is finished. */
  step(): boolean {
    if (this.phase !== 'revealing') return false;
    if (this.cursor >= this.endIndex) {
      this.finish();
      return false;
    }
    this.cursor++;
    const c = this.candles[this.cursor];
    const o = this.order!;
    const { slippageBps } = this.scenario.costs;
    const slip = slippageBps / 10000;
    if (o.side !== 'skip' && !this.open && !this.trade && this.cursor === this.scenario.decisionIndex + 1) {
      const dir = o.side === 'long' ? 1 : -1;
      const entryPrice = c.o * (1 + dir * slip);
      const notional = this.scenario.capital * o.sizeFrac;
      const qty = notional / entryPrice;
      this.open = { side: o.side, entryIndex: this.cursor, entryPrice, qty, notional, maxP: entryPrice, minP: entryPrice, entrySlip: Math.abs(entryPrice - c.o) * qty };
    }
    if (this.open) {
      const t = this.open;
      const stop = this.liveStop;
      const tp = this.liveTp;
      if (this.pendingClose && this.cursor > t.entryIndex) {
        this.pendingClose = false;
        return this.closeAndContinue(c.o, 'manual');
      }
      // Gap through the stop at the open → filled at the open.
      if (stop != null) {
        const gap = t.side === 'long' ? c.o <= stop : c.o >= stop;
        if (gap && this.cursor > t.entryIndex) return this.closeAndContinue(c.o, 'gap_stop');
      }
      t.maxP = Math.max(t.maxP, c.h);
      t.minP = Math.min(t.minP, c.l);
      const hitStop = stop != null && (t.side === 'long' ? c.l <= stop : c.h >= stop);
      const hitTp = tp != null && (t.side === 'long' ? c.h >= tp : c.l <= tp);
      if (hitStop) return this.closeAndContinue(stop!, 'stop'); // both touched → stop first (conservative)
      if (hitTp) return this.closeAndContinue(tp!, 'target');
    }
    if (this.cursor >= this.endIndex) {
      if (this.open) this.close(c.c, 'horizon');
      this.finish();
      return false;
    }
    return true;
  }

  /** Reveal everything that remains (fast-forward). */
  runToEnd(): void {
    while (this.phase === 'revealing' && this.step()) {
      /* keep stepping */
    }
    if (this.phase === 'revealing') this.finish();
  }

  private closeAndContinue(rawPrice: number, reason: Trade['exitReason']): boolean {
    this.close(rawPrice, reason);
    if (this.cursor >= this.endIndex) {
      this.finish();
      return false;
    }
    return true;
  }

  private close(rawPrice: number, reason: Trade['exitReason']): boolean {
    const t = this.open!;
    const o = this.order!;
    const { feeBps, slippageBps } = this.scenario.costs;
    const dir = t.side === 'long' ? 1 : -1;
    const exitPrice = rawPrice * (1 - dir * (slippageBps / 10000));
    const grossPnl = dir * t.qty * (exitPrice - t.entryPrice);
    const fees = (t.notional + t.qty * exitPrice) * (feeBps / 10000);
    const slippageCost = t.entrySlip + Math.abs(exitPrice - rawPrice) * t.qty;
    const netPnl = grossPnl - fees;
    const plannedRisk = o.stopPrice != null ? t.qty * Math.abs(t.entryPrice - o.stopPrice) : null;
    this.trade = {
      side: t.side,
      entryIndex: t.entryIndex,
      entryPrice: t.entryPrice,
      qty: t.qty,
      notional: t.notional,
      stopPrice: o.stopPrice,
      takeProfit: o.takeProfit,
      exitIndex: this.cursor,
      exitPrice,
      exitReason: reason,
      grossPnl,
      fees,
      slippageCost,
      netPnl,
      rMultiple: plannedRisk ? netPnl / plannedRisk : null,
      mae: (dir > 0 ? (t.entryPrice - t.minP) / t.entryPrice : (t.maxP - t.entryPrice) / t.entryPrice) * 100,
      mfe: (dir > 0 ? (t.maxP - t.entryPrice) / t.entryPrice : (t.entryPrice - t.minP) / t.entryPrice) * 100,
      finalStop: this.liveStop,
      finalTarget: this.liveTp,
    };
    this.open = null;
    // The remaining candles are still revealed (the player sees what happened next).
    return this.cursor < this.endIndex;
  }

  private finish(): void {
    this.phase = 'review';
  }

  /** What the market did after the decision (for the review; only valid after reveal). */
  afterMove(): { maxUpPct: number; maxDownPct: number; endPct: number } | null {
    if (this.phase !== 'review') return null;
    const ref = this.decisionCandle.c;
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = this.scenario.decisionIndex + 1; i <= this.endIndex; i++) {
      hi = Math.max(hi, this.candles[i].h);
      lo = Math.min(lo, this.candles[i].l);
    }
    const end = this.candles[this.endIndex].c;
    return { maxUpPct: ((hi - ref) / ref) * 100, maxDownPct: ((lo - ref) / ref) * 100, endPct: ((end - ref) / ref) * 100 };
  }
}
